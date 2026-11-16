import { createHash } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  AppContextSchema, CreateProductSchema, DeleteProductSchema, DomainError,
  GetProductSchema, ListProductsSchema, UpdateProductSchema, validate,
  type AppContext, type CreateProductInput, type DeleteProductInput,
  type GetProductInput, type ListProductsInput, type MutationResult,
  type Product, type ProductPage, type ProductRepository, type UpdateProductInput,
} from './domain.js';

export type DatabasePool = Pick<Pool, 'query' | 'connect'>;
type Operation = 'create' | 'update' | 'delete';

interface ProductRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  price_cents: number;
  stock: number;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

const columns = 'id, tenant_id, sku, name, price_cents, stock, version, created_at, updated_at, deleted_at';
const iso = (value: Date | string): string => new Date(value).toISOString();

function toProduct(row: ProductRow): Product {
  return {
    id: row.id, sku: row.sku, name: row.name,
    priceCents: row.price_cents, stock: row.stock, version: row.version,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
    deletedAt: row.deleted_at === null ? null : iso(row.deleted_at),
  };
}

function safeError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const details = typeof error === 'object' && error !== null
    ? error as { code?: string; constraint?: string }
    : {};
  if (details.code === '23505' && details.constraint === 'products_tenant_sku_key') {
    return new DomainError('SKU_EXISTS', 'That SKU already exists in your workspace, including archived products.');
  }
  return new DomainError('DATABASE_ERROR', 'The database operation failed; no change was confirmed.');
}

function requireEditor(context: AppContext): void {
  if (context.role !== 'editor') {
    throw new DomainError('FORBIDDEN', 'Your role permits reading products only.');
  }
}

/** Fixed SQL with validated values. No table names, tenant IDs or SQL come from the model. */
export class PgProductRepository implements ProductRepository {
  constructor(private readonly pool: DatabasePool) {}

  async list(context: AppContext, input: ListProductsInput): Promise<ProductPage> {
    const ctx = validate(AppContextSchema, context);
    const args = validate(ListProductsSchema, input);
    // Escape LIKE metacharacters so a search is literal, not a user-defined pattern.
    const term = args.query ? `%${args.query.replace(/[\\%_]/g, '\\$&')}%` : null;
    try {
      const result = await this.pool.query<ProductRow>(
        `SELECT ${columns} FROM products
         WHERE tenant_id = $1 AND deleted_at IS NULL
           AND ($2::text IS NULL OR name ILIKE $2 ESCAPE '\\' OR sku ILIKE $2 ESCAPE '\\')
         ORDER BY created_at, id LIMIT $3 OFFSET $4`,
        [ctx.tenantId, term, args.limit + 1, args.offset],
      );
      const hasMore = result.rows.length > args.limit;
      return {
        products: result.rows.slice(0, args.limit).map(toProduct),
        nextOffset: hasMore && args.offset + args.limit <= 10_000 ? args.offset + args.limit : null,
      };
    } catch (error) {
      throw safeError(error);
    }
  }

  async get(context: AppContext, input: GetProductInput): Promise<Product> {
    const ctx = validate(AppContextSchema, context);
    const args = validate(GetProductSchema, input);
    try {
      const result = await this.pool.query<ProductRow>(
        `SELECT ${columns} FROM products WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [ctx.tenantId, args.id],
      );
      if (!result.rows[0]) throw new DomainError('NOT_FOUND', 'No active product with that ID is available in your workspace.');
      return toProduct(result.rows[0]);
    } catch (error) {
      throw safeError(error);
    }
  }

  async create(context: AppContext, input: CreateProductInput): Promise<MutationResult> {
    const ctx = validate(AppContextSchema, context);
    requireEditor(ctx);
    const args = validate(CreateProductSchema, input);
    return this.write(ctx, 'create', args, async client => {
      const result = await client.query<ProductRow>(
        `INSERT INTO products (tenant_id, sku, name, price_cents, stock)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${columns}`,
        [ctx.tenantId, args.sku, args.name, args.priceCents, args.stock],
      );
      return { before: null, after: toProduct(result.rows[0]!) };
    });
  }

  async update(context: AppContext, input: UpdateProductInput): Promise<MutationResult> {
    const ctx = validate(AppContextSchema, context);
    requireEditor(ctx);
    const args = validate(UpdateProductSchema, input);
    if (args.name === null && args.priceCents === null && args.stock === null) {
      throw new DomainError('VALIDATION_ERROR', 'Specify at least one field to change.');
    }
    return this.write(ctx, 'update', args, async client => {
      const before = await this.lockProduct(client, ctx, args.id, args.expectedVersion);
      const result = await client.query<ProductRow>(
        `UPDATE products
         SET name = COALESCE($4, name), price_cents = COALESCE($5, price_cents),
             stock = COALESCE($6, stock), version = version + 1, updated_at = now()
         WHERE tenant_id = $1 AND id = $2 AND version = $3 AND deleted_at IS NULL
         RETURNING ${columns}`,
        [ctx.tenantId, args.id, args.expectedVersion, args.name, args.priceCents, args.stock],
      );
      if (!result.rows[0]) throw new DomainError('CONFLICT', 'The product changed. Read its current version before proposing another change.');
      return { before, after: toProduct(result.rows[0]) };
    });
  }

  async softDelete(context: AppContext, input: DeleteProductInput): Promise<MutationResult> {
    const ctx = validate(AppContextSchema, context);
    requireEditor(ctx);
    const args = validate(DeleteProductSchema, input);
    return this.write(ctx, 'delete', args, async client => {
      const before = await this.lockProduct(client, ctx, args.id, args.expectedVersion);
      const result = await client.query<ProductRow>(
        `UPDATE products SET deleted_at = now(), updated_at = now(), version = version + 1
         WHERE tenant_id = $1 AND id = $2 AND version = $3 AND deleted_at IS NULL
         RETURNING ${columns}`,
        [ctx.tenantId, args.id, args.expectedVersion],
      );
      if (!result.rows[0]) throw new DomainError('CONFLICT', 'The product changed. Read its current version before proposing another change.');
      return { before, after: toProduct(result.rows[0]) };
    });
  }

  private async lockProduct(client: PoolClient, ctx: AppContext, id: string, expectedVersion: number): Promise<Product> {
    const result = await client.query<ProductRow>(
      `SELECT ${columns} FROM products
       WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [ctx.tenantId, id],
    );
    if (!result.rows[0]) throw new DomainError('NOT_FOUND', 'No active product with that ID is available in your workspace.');
    const product = toProduct(result.rows[0]);
    if (product.version !== expectedVersion) {
      throw new DomainError('CONFLICT', 'The product changed. Read its current version before proposing another change.');
    }
    return product;
  }

  private async write(
    ctx: AppContext,
    operation: Operation,
    args: CreateProductInput | UpdateProductInput | DeleteProductInput,
    mutate: (client: PoolClient) => Promise<{ before: Product | null; after: Product }>,
  ): Promise<MutationResult> {
    const requestKey = createHash('sha256')
      .update(JSON.stringify([ctx.userId, ctx.requestId, operation, args]))
      .digest('hex');
    let client: PoolClient | undefined;
    let begun = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      begun = true;
      await client.query("SET LOCAL statement_timeout = '5s'");
      // Serializes replay checks for this tenant+call. Different products/calls can proceed.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${ctx.tenantId}:${requestKey}`]);
      const receipt = await client.query<{ result: Product }>(
        'SELECT result FROM operation_receipts WHERE tenant_id = $1 AND request_key = $2',
        [ctx.tenantId, requestKey],
      );
      if (receipt.rows[0]) {
        await client.query('COMMIT');
        begun = false;
        return { product: receipt.rows[0].result, replayed: true };
      }
      const { before, after } = await mutate(client);
      await client.query(
        `INSERT INTO audit_logs (tenant_id, actor_id, request_id, action, product_id, before_data, after_data)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
        [ctx.tenantId, ctx.userId, ctx.requestId, operation, after.id,
          before === null ? null : JSON.stringify(before), JSON.stringify(after)],
      );
      await client.query(
        `INSERT INTO operation_receipts (tenant_id, request_key, actor_id, request_id, operation, result)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [ctx.tenantId, requestKey, ctx.userId, ctx.requestId, operation, JSON.stringify(after)],
      );
      await client.query('COMMIT');
      begun = false;
      return { product: after, replayed: false };
    } catch (error) {
      if (client && begun) {
        // Preserve the original error even if a broken connection prevents rollback.
        try { await client.query('ROLLBACK'); } catch { /* Connection may already be closed. */ }
      }
      throw safeError(error);
    } finally {
      client?.release();
    }
  }
}
