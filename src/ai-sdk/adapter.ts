import { generateText, isStepCount, type LanguageModel, type ModelMessage, type ToolApprovalResponse } from 'ai';
import { approvalPreview } from '../approval.js';
import { AppContextSchema, DomainError, validate, type AppContext, type ProductRepository } from '../domain.js';
import { INVENTORY_INSTRUCTIONS } from '../inventory-instructions.js';
import type { MutationReceipt } from '../tools.js';
import { createAiInventoryTools } from './tools.js';

export const WRITE_APPROVAL = {
  create_product: 'user-approval', update_product: 'user-approval', delete_product: 'user-approval',
} as const;
type ReviewIO = {
  display(preview: Awaited<ReturnType<typeof approvalPreview>>): void | Promise<void>;
  ask(prompt: string): Promise<string>;
  error(message: string): void | Promise<void>;
};

/** Server-owned local run. The browser/model never supplies continuation messages or context. */
export class AiInventoryRun {
  readonly context: Readonly<AppContext>;
  readonly tools: ReturnType<typeof createAiInventoryTools>;
  #messages: ModelMessage[];
  #pending: any[] = [];
  #outputs: unknown[] = [];
  #text = '';
  #steps = 0;
  #busy = false;
  #started = false;
  constructor(private repository: ProductRepository, private model: LanguageModel, context: AppContext,
    prompt: string, onMutation?: (receipt: MutationReceipt) => void, history: ModelMessage[] = []) {
    if (!prompt.trim() || prompt.length > 4000) throw new DomainError('VALIDATION_ERROR', 'Use a nonempty request up to 4000 characters.');
    this.context = Object.freeze(validate(AppContextSchema, context));
    this.tools = createAiInventoryTools(repository, this.context, onMutation);
    this.#messages = [...structuredClone(history), { role: 'user', content: prompt }];
  }
  get pending() { return structuredClone(this.#pending); }
  get history() { return structuredClone(this.#messages); }
  get outputs() { return structuredClone(this.#outputs); }
  get finalAnswer() { return this.#pending.length ? undefined : this.#text; }

  async #generate() {
    if (this.#steps >= 8) throw new Error('Run step budget exhausted; inspect receipts before retrying.');
    const result = await generateText({
      model: this.model, system: INVENTORY_INSTRUCTIONS, tools: this.tools,
      messages: this.#messages, toolApproval: WRITE_APPROVAL,
      stopWhen: isStepCount(8 - this.#steps), maxRetries: 0, maxOutputTokens: 2000,
      providerOptions: { openai: { parallelToolCalls: false } },
    });
    this.#steps += result.steps.length;
    this.#messages.push(...result.responseMessages);
    this.#pending = result.content.filter(part => part.type === 'tool-approval-request' && !part.isAutomatic);
    this.#outputs.push(...result.steps.flatMap(step => step.toolResults.map(part => part.output)));
    this.#text = result.text;
  }
  async start() {
    if (this.#started || this.#busy) throw new Error('This run already started.');
    this.#started = this.#busy = true;
    try { await this.#generate(); } finally { this.#busy = false; }
  }
  async review(io: ReviewIO) {
    if (this.#busy || !this.#pending.length) throw new Error('No reviewable pending call.');
    this.#busy = true;
    try {
      const responses: ToolApprovalResponse[] = [];
      for (const pending of this.#pending) {
        const call = pending.toolCall;
        let approved = false;
        let reason = 'Approval denied. The operation was not executed. Do not automatically resubmit it.';
        try {
          const preview = await approvalPreview(this.repository, this.context, call.toolName, JSON.stringify(call.input));
          await io.display(preview);
          approved = (await io.ask('Type approve for this exact change; anything else rejects: ')).trim() === 'approve';
        } catch (error) {
          reason = error instanceof DomainError ? `${error.code}: ${error.message}` : 'Unable to validate this approval.';
          await io.error(reason);
        }
        responses.push({ type: 'tool-approval-response', approvalId: pending.approvalId, approved, reason });
      }
      this.#messages.push({ role: 'tool', content: responses });
      this.#pending = [];
      await this.#generate();
    } finally { this.#busy = false; }
  }
}
