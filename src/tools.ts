import { tool, type RunContext } from '@openai/agents';
import {
  CreateProductSchema, DeleteProductSchema, DomainError, GetProductSchema,
  ListProductsSchema, UpdateProductSchema,
  type AppContext, type MutationResult, type ProductRepository,
} from './domain.js';

export type MutationReceipt = { action: string; requestId: string } & MutationResult;

function contextOf(runContext?: RunContext<AppContext>): AppContext {
  if (!runContext?.context) throw new DomainError('FORBIDDEN', 'Trusted application context is required.');
  return runContext.context;
}

/** Return bounded application errors. Never send raw driver exceptions to the model. */
async function safeCall<T>(operation: () => Promise<T>) {
  try { return { ok: true as const, data: await operation() }; }
  catch (error) {
    return { ok: false as const, error: error instanceof DomainError
      ? { code: error.code, message: error.message }
      : { code: 'INTERNAL_ERROR', message: 'The operation failed. No success is confirmed; check the database before retrying.' } };
  }
}

const toolError = () => JSON.stringify({ ok: false, error: {
  code: 'TOOL_INPUT_ERROR', message: 'Tool input was invalid or the call was not approved.',
} });

export function createInventoryTools(
  repository: ProductRepository,
  onMutation?: (receipt: MutationReceipt) => void,
) {
  async function mutation(action: string, ctx: AppContext, work: () => Promise<MutationResult>) {
    const result = await work();
    // Reporting must not turn a committed database operation into an apparent failure.
    try { onMutation?.({ action, requestId: ctx.requestId, ...result }); } catch { /* receipt remains in DB */ }
    return result;
  }

  return [
    tool({
      name: 'list_products',
      description: 'Search or browse active products in the current tenant by literal SKU/name substring, or query null for all. Start with limit 10 and offset 0; follow returned nextOffset only when more results are needed. Returns ok:true with products and nextOffset; an empty products array is a successful search with no matches, not an error. Failures return ok:false with a safe error. Read-only; no write approval required.',
      parameters: ListProductsSchema,
      errorFunction: toolError,
      execute: (args, ctx?: RunContext<AppContext>) => safeCall(() => repository.list(contextOf(ctx), args)),
    }),
    tool({
      name: 'get_product',
      description: 'Retrieve one active product by an exact product UUID supplied by the user or returned by a tool. For a name or SKU, use list_products first; never invent an ID. Returns ok:true with the product and current version, or ok:false with NOT_FOUND when no active product with that ID is available in the current tenant. Other failures return a safe error. Read-only; no write approval required.',
      parameters: GetProductSchema,
      errorFunction: toolError,
      execute: (args, ctx?: RunContext<AppContext>) => safeCall(() => repository.get(contextOf(ctx), args)),
    }),
    tool({
      name: 'create_product',
      description: 'Propose creating one product using SKU, name, EUR price in integer cents, and stock. Call this tool when the inputs are complete: the SDK pauses the call BEFORE execution so the host can obtain human approval. Do not ask for chat approval first or substitute a JSON proposal. After approval, return only the committed result.',
      parameters: CreateProductSchema,
      needsApproval: true,
      errorFunction: toolError,
      execute: (args, ctx?: RunContext<AppContext>) => safeCall(() => {
        const context = contextOf(ctx);
        return mutation('create_product', context, () => repository.create(context, args));
      }),
    }),
    tool({
      name: 'update_product',
      description: 'Propose updating one active product using a fresh expectedVersion. Null fields stay unchanged; at least one field must be supplied. stock is an absolute quantity. Call this tool to open SDK approval; the repository does not execute until the host approves. Do not replace the tool call with a chat proposal or ask for chat approval first.',
      parameters: UpdateProductSchema,
      needsApproval: true,
      errorFunction: toolError,
      execute: (args, ctx?: RunContext<AppContext>) => safeCall(() => {
        const context = contextOf(ctx);
        return mutation('update_product', context, () => repository.update(context, args));
      }),
    }),
    tool({
      name: 'delete_product',
      description: 'Propose archiving (soft-deleting) one product by exact ID and current expectedVersion. The row remains stored and is hidden from normal reads. Call this tool to open SDK approval; execution waits for the host decision. Do not replace the tool call with a chat proposal or ask for chat approval first.',
      parameters: DeleteProductSchema,
      needsApproval: true,
      errorFunction: toolError,
      execute: (args, ctx?: RunContext<AppContext>) => safeCall(() => {
        const context = contextOf(ctx);
        return mutation('delete_product', context, () => repository.softDelete(context, args));
      }),
    }),
  ];
}
