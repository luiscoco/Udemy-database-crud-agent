import { randomUUID } from 'node:crypto';
import { stripVTControlCharacters } from 'node:util';
import { Runner, type AgentInputItem } from '@openai/agents';
import { type createInventoryAgent } from './agent.js';
import { reviewInterruption } from './approval.js';
import { AppContextSchema, type AppContext, type ProductRepository } from './domain.js';

export const CONVERSATION_LIMITS = Object.freeze({
  maxTurns: 8, approvalRounds: 8, historyItems: 120, inputCharacters: 4000,
});
type Limits = { [Key in keyof typeof CONVERSATION_LIMITS]: number };
export type ConversationOptions = {
  agent: ReturnType<typeof createInventoryAgent>;
  runner: Runner;
  repository: ProductRepository;
  identity: Pick<AppContext, 'tenantId' | 'userId' | 'role'>;
  io: {
    question(prompt: string): Promise<string | null>;
    write(message: string): void;
    error(message: string): void;
  };
  initialize?(): Promise<void>;
  dispose(): Promise<void>;
  limits?: Partial<Limits>;
};

/** Application-owned replay history; chat and tool arguments never supply identity. */
export async function runConversation(options: ConversationOptions): Promise<void> {
  const { agent, runner, repository, io } = options;
  let history: AgentInputItem[] = [];
  try {
    const limits = { ...CONVERSATION_LIMITS, ...options.limits };
    if (Object.values(limits).some(value => !Number.isSafeInteger(value) || value < 1)) {
      throw new Error('Conversation limits must be positive integers.');
    }
    const trusted = AppContextSchema.parse({ ...options.identity, requestId: randomUUID() });
    const identity = Object.freeze({ tenantId: trusted.tenantId, userId: trusted.userId, role: trusted.role });
    await options.initialize?.();
    io.write('Commands: /reset clears conversation; /quit or /exit exits. Writes require typing approve.');
    io.write(`Identity: ${identity.userId}; role: ${identity.role}; tenant: ${identity.tenantId}`);
    while (true) {
      const answer = await io.question('\nYou> ');
      if (answer === null) break; // End of input releases resources too.
      const text = answer.trim();
      if (text === '/quit' || text === '/exit') break;
      if (text === '/reset') {
        history = [];
        io.write('Conversation cleared. Database unchanged.');
        continue;
      }
      if (!text) continue;
      if (text.length > limits.inputCharacters) {
        io.write(`Please keep a request under ${limits.inputCharacters} characters.`);
        continue;
      }
      const context = Object.freeze({ ...identity, requestId: randomUUID() });
      io.write(`[Request ${context.requestId}]`);
      try {
        let result = await runner.run(agent, [...history, { role: 'user', content: text }],
          { context, maxTurns: limits.maxTurns });
        let approvalRounds = 0;
        while (result.interruptions.length > 0) {
          if (++approvalRounds > limits.approvalRounds) throw new Error('Too many approval rounds.');
          for (const interruption of result.interruptions) {
            await reviewInterruption(repository, context, interruption, result.state, {
              display: preview => io.write('\n[Exact proposed database change] ' + JSON.stringify(preview, null, 2)),
              ask: async prompt => (await io.question(prompt)) ?? '',
              error: message => io.error(message),
            });
          }
          result = await runner.run(agent, result.state, { context, maxTurns: limits.maxTurns });
        }
        history = result.history;
        io.write('\nAgent> ' + stripVTControlCharacters(result.finalOutput ?? '(No final text returned.)'));
        // Clear only after completion: never cut a tool call away from its result.
        if (history.length > limits.historyItems) {
          history = [];
          io.write(`[Conversation reset after ${limits.historyItems} items; database state is unchanged.]`);
        }
      } catch {
        history = [];
        io.error(`Run stopped (request ${context.requestId}). Check printed receipts or audit_logs before retrying; a prior write may have committed. Conversation cleared.`);
      }
    }
  } finally {
    await options.dispose();
  }
}
