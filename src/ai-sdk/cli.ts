import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { stripVTControlCharacters } from 'node:util';
import { createOpenAI } from '@ai-sdk/openai';
import type { ModelMessage } from 'ai';
import { createPool, demoContext, requiredEnv } from '../config.js';
import { PgProductRepository } from '../repository.js';
import { AiInventoryRun } from './adapter.js';

async function main() {
  const model = createOpenAI({ apiKey: requiredEnv('OPENAI_API_KEY') })(requiredEnv('OPENAI_MODEL'));
  const identity = demoContext(); // Same local fixture; not deployed authentication.
  delete process.env.DATABASE_ADMIN_URL;
  const pool = createPool(), repository = new PgProductRepository(pool);
  const terminal = createInterface({ input: stdin, output: stdout });
  let closed = false;
  const ended = new Promise<null>(resolve => terminal.once('close', () => { closed = true; resolve(null); }));
  const question = (prompt: string) => closed ? Promise.resolve(null) : Promise.race([terminal.question(prompt), ended]);
  let history: ModelMessage[] = [];
  try {
    await pool.query('SELECT 1');
    console.log('AI SDK inventory adapter. /reset clears history; /quit or /exit exits.');
    while (true) {
      const text = await question('\nYou> ');
      if (text === null || ['/quit', '/exit'].includes(text.trim())) break;
      if (text.trim() === '/reset') { history = []; console.log('Conversation cleared. Database unchanged.'); continue; }
      if (!text.trim()) continue;
      const context = Object.freeze({ ...identity, requestId: randomUUID() });
      console.log(`[Request ${context.requestId}]`);
      try {
        const run = new AiInventoryRun(repository, model, context, text,
          receipt => console.log('[Database receipt]', JSON.stringify(receipt)), history);
        await run.start();
        let rounds = 0;
        while (run.pending.length) {
          if (++rounds > 8) throw new Error('Approval-round limit exceeded.');
          await run.review({ display: preview => { console.log(JSON.stringify(preview, null, 2)); },
            ask: async prompt => (await question(prompt)) ?? '', error: message => { console.error(message); } });
        }
        history = run.history.length > 120 ? [] : run.history;
        console.log('Agent> ' + stripVTControlCharacters(run.finalAnswer ?? '(No final text returned.)'));
      } catch {
        history = [];
        console.error(`Run stopped (request ${context.requestId}). Check receipts/audits before retrying; a write may have committed. Conversation cleared.`);
      }
    }
  } finally { try { terminal.close(); } finally { await pool.end(); } }
}
main().catch(() => { console.error('AI SDK session stopped. Check local model/key and database configuration.'); process.exitCode = 1; });
