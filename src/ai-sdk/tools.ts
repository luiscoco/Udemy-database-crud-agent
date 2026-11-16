import { tool } from 'ai';
import {
  AppContextSchema, CreateProductSchema, DeleteProductSchema, DomainError,
  GetProductSchema, ListProductsSchema, UpdateProductSchema, validate,
  type AppContext, type MutationResult, type ProductRepository,
} from '../domain.js';
import type { MutationReceipt } from '../tools.js';

export function createAiInventoryTools(
  repository: ProductRepository, context: AppContext,
  onMutation?: (receipt: MutationReceipt) => void,
) {
  // One immutable host context per run; no identity fields in model input schemas.
  const trusted = Object.freeze(validate(AppContextSchema, context));
  async function safe<T>(work: () => Promise<T>) {
    try { return { ok: true as const, data: await work() }; }
    catch (error) {
      return { ok: false as const, error: error instanceof DomainError
        ? { code: error.code, message: error.message }
        : { code: 'INTERNAL_ERROR', message: 'The operation failed. No success is confirmed; check the database before retrying.' } };
    }
  }
  async function mutation(action: string, work: () => Promise<MutationResult>) {
    const result = await work();
    try { onMutation?.({ action, requestId: trusted.requestId, ...result }); }
    catch { /* The durable receipt remains committed. */ }
    return result;
  }
  return {
    list_products: tool({
      description: 'Search active products in this tenant by literal SKU/name substring, or query null for all. Start with limit 10 and offset 0. Follow nextOffset. An empty products array is a successful search, not failure. Read-only, no write approval.',
      inputSchema: ListProductsSchema, strict: true,
      execute: args => safe(() => repository.list(trusted, args)),
    }),
    get_product: tool({
      description: 'Read an active product by exact UUID supplied by the user or returned by list_products. Resolve SKU/name through list_products first. Returns current version or safe NOT_FOUND. Read-only, no write approval.',
      inputSchema: GetProductSchema, strict: true,
      execute: args => safe(() => repository.get(trusted, args)),
    }),
    create_product: tool({
      description: 'Propose creation with complete SKU, name, integer EUR priceCents and stock. Call when all values are known. The host reviews this exact call before execution; do not substitute chat approval. Return only committed results.',
      inputSchema: CreateProductSchema, strict: true,
      execute: args => safe(() => mutation('create_product', () => repository.create(trusted, args))),
    }),
    update_product: tool({
      description: 'Propose updating the exact product using its fresh expectedVersion. Null fields stay unchanged; supply at least one change. Stock is absolute. Host approval precedes execution; do not substitute a chat proposal.',
      inputSchema: UpdateProductSchema, strict: true,
      execute: args => safe(() => mutation('update_product', () => repository.update(trusted, args))),
    }),
    delete_product: tool({
      description: 'Propose archiving an exact product ID with its fresh expectedVersion. The row remains stored and disappears from active reads. Host approval precedes execution; do not substitute a chat proposal.',
      inputSchema: DeleteProductSchema, strict: true,
      execute: args => safe(() => mutation('delete_product', () => repository.softDelete(trusted, args))),
    }),
  };
}
