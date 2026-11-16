import { z } from 'zod';

/** Host-supplied identity. Never accept these fields as model tool arguments. */
export interface AppContext {
  tenantId: string;
  userId: string;
  role: 'reader' | 'editor';
  requestId: string;
}

export const AppContextSchema = z.object({
  tenantId: z.uuid(),
  userId: z.string().trim().min(1).max(128),
  role: z.enum(['reader', 'editor']),
  requestId: z.uuid(),
}).strict();

const quantity = z.number().int().min(0).max(2_147_483_647);
const productName = z.string().trim().min(1).max(120);

export const ListProductsSchema = z.object({
  query: z.string().trim().max(100).nullable(),
  limit: z.number().int().min(1).max(50),
  offset: z.number().int().min(0).max(10_000),
}).strict();

export const GetProductSchema = z.object({ id: z.uuid() }).strict();

export const CreateProductSchema = z.object({
  sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,31}$/),
  name: productName,
  priceCents: quantity,
  stock: quantity,
}).strict();

// Null means "leave unchanged". All fields stay required in the tool JSON schema.
export const UpdateProductSchema = z.object({
  id: z.uuid(),
  expectedVersion: z.number().int().min(1).max(2_147_483_647),
  name: productName.nullable(),
  priceCents: quantity.nullable(),
  stock: quantity.nullable(),
}).strict();

export const DeleteProductSchema = z.object({
  id: z.uuid(),
  expectedVersion: z.number().int().min(1).max(2_147_483_647),
}).strict();

export type ListProductsInput = z.infer<typeof ListProductsSchema>;
export type GetProductInput = z.infer<typeof GetProductSchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type DeleteProductInput = z.infer<typeof DeleteProductSchema>;

export interface Product {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProductPage {
  products: Product[];
  nextOffset: number | null;
}

export interface MutationResult {
  product: Product;
  replayed: boolean;
}

export interface ProductRepository {
  list(context: AppContext, input: ListProductsInput): Promise<ProductPage>;
  get(context: AppContext, input: GetProductInput): Promise<Product>;
  create(context: AppContext, input: CreateProductInput): Promise<MutationResult>;
  update(context: AppContext, input: UpdateProductInput): Promise<MutationResult>;
  softDelete(context: AppContext, input: DeleteProductInput): Promise<MutationResult>;
}

export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SKU_EXISTS'
  | 'DATABASE_ERROR';

/** Safe to expose to the model. Raw SQL, connection strings and pg errors are not. */
export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    // Do not echo rejected input, since it can contain credentials or instructions.
    throw new DomainError('VALIDATION_ERROR', 'The request contains invalid or unsupported fields.');
  }
  return result.data;
}
