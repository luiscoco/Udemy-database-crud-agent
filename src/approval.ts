import type { RunToolApprovalItem } from '@openai/agents';
import {
  CreateProductSchema, DeleteProductSchema, DomainError, UpdateProductSchema,
  validate, type AppContext, type ProductRepository,
} from './domain.js';

/** Host-built preview of the exact SDK call. No model-generated approval summary. */
export async function approvalPreview(
  repository: ProductRepository, context: AppContext,
  toolName: string | undefined, rawArguments: string | undefined,
) {
  if (context.role !== 'editor') throw new DomainError('FORBIDDEN', 'This user is read-only.');
  if (!rawArguments || !toolName) throw new DomainError('VALIDATION_ERROR', 'Missing approval details.');
  let input: unknown;
  try { input = JSON.parse(rawArguments); }
  catch { throw new DomainError('VALIDATION_ERROR', 'Invalid approval arguments.'); }

  if (toolName === 'create_product') {
    const args = validate(CreateProductSchema, input);
    return { tool: toolName, tenantId: context.tenantId, userId: context.userId,
      requestId: context.requestId, arguments: args, current: null,
      proposed: { ...args, version: 1 }, proposedProduct: args, currency: 'EUR' };
  }
  if (toolName !== 'update_product' && toolName !== 'delete_product') {
    throw new DomainError('FORBIDDEN', 'This tool is not an approved mutation type.');
  }
  const args = toolName === 'update_product'
    ? validate(UpdateProductSchema, input) : validate(DeleteProductSchema, input);
  const current = await repository.get(context, { id: args.id });
  if (current.version !== args.expectedVersion) {
    throw new DomainError('CONFLICT', 'The product changed. Read it again before proposing a new write.');
  }
  if (toolName === 'update_product') {
    const update = validate(UpdateProductSchema, input);
    if (update.name === null && update.priceCents === null && update.stock === null) {
      throw new DomainError('VALIDATION_ERROR', 'An update must include a field to change.');
    }
    return { tool: toolName, tenantId: context.tenantId, userId: context.userId,
      requestId: context.requestId, arguments: update, current,
      proposed: { name: update.name ?? current.name, priceCents: update.priceCents ?? current.priceCents,
        stock: update.stock ?? current.stock, version: current.version + 1 }, currency: 'EUR' };
  }
  return { tool: toolName, tenantId: context.tenantId, userId: context.userId,
    requestId: context.requestId, arguments: args, current,
    proposed: { name: current.name, priceCents: current.priceCents, stock: current.stock,
      version: current.version + 1, active: false },
    effect: 'Archive this product; set the archive timestamp at execution and hide it from active reads.' };
}

type DecisionState = {
  approve(interruption: RunToolApprovalItem): void;
  reject(interruption: RunToolApprovalItem, options?: { message?: string }): void;
};
type ReviewIO = {
  display(preview: Awaited<ReturnType<typeof approvalPreview>>): void | Promise<void>;
  ask(prompt: string): Promise<string>;
  error(message: string): void | Promise<void>;
};

/** Review one exact pending call. No blanket approval; unclear input and I/O failures reject. */
export async function reviewInterruption(
  repository: ProductRepository, context: AppContext,
  interruption: RunToolApprovalItem, state: DecisionState, io: ReviewIO,
) {
  const name = interruption.name;
  const rawArguments = interruption.arguments;
  try {
    const preview = await approvalPreview(repository, context, name, rawArguments);
    await io.display(preview);
    const answer = await io.ask('Type approve to execute this one change; anything else rejects: ');
    if (interruption.name !== name || interruption.arguments !== rawArguments) {
      throw new DomainError('CONFLICT', 'The pending call changed during review. Reject it and review again.');
    }
    if (answer.trim() === 'approve') {
      state.approve(interruption);
      return { decision: 'approve' as const, preview };
    }
    state.reject(interruption, { message: 'Approval denied. The proposed operation was not executed. Do not automatically resubmit it.' });
    return { decision: 'reject' as const, preview };
  } catch (error) {
    const message = error instanceof DomainError ? `${error.code}: ${error.message}` : 'Unable to validate this approval.';
    state.reject(interruption, { message: `${message} The proposed operation was not executed. Do not automatically resubmit it.` });
    await io.error(message);
    return { decision: 'reject' as const, error: message };
  }
}
