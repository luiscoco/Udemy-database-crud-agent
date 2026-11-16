import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Runner } from '@openai/agents';
import { createInventoryAgent } from './agent.js';
import { runConversation } from './conversation.js';
import { createPool, demoContext, requiredEnv } from './config.js';
import { PgProductRepository } from './repository.js';

async function main() {
  requiredEnv('OPENAI_API_KEY');
  const model = requiredEnv('OPENAI_MODEL');
  const identity = demoContext(); // Local fixture; replace with authenticated host identity.
  delete process.env.DATABASE_ADMIN_URL;
  const pool = createPool();
  const terminal = createInterface({ input: stdin, output: stdout });
  let closed = false;
  const ended = new Promise<null>(resolve => terminal.once('close', () => { closed = true; resolve(null); }));
  const repository = new PgProductRepository(pool);
  const runner = new Runner({ tracingDisabled: true });
  const agent = createInventoryAgent(repository, model, receipt => {
    console.log('\n[Database receipt]', JSON.stringify(receipt, null, 2));
  });
  console.log('Inventory Database Agent — EUR prices, one tenant, local demo identity.');
  console.log('Successful writes print a database receipt independently of the model response.');
  await runConversation({
    agent, runner, repository, identity,
    initialize: async () => { await pool.query('SELECT 1'); },
    io: {
      question: prompt => closed ? Promise.resolve(null) : Promise.race([terminal.question(prompt), ended]),
      write: message => console.log(message),
      error: message => console.error(message),
    },
    dispose: async () => {
      try { terminal.close(); }
      finally { await pool.end(); }
    },
  });
}

main().catch(() => {
  console.error('Session stopped. Check .env, API model/key, and PostgreSQL; run npm run db:setup first.');
  process.exitCode = 1;
});
