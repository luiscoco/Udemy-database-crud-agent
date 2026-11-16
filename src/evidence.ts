import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { AppContextSchema, DomainError, validate, type AppContext } from './domain.js';
import type { DatabasePool } from './repository.js';

export const EvidenceSelector = z.object({
  requestId: z.uuid().nullable(), productId: z.uuid().nullable(),
}).strict().refine(s => s.requestId !== null || s.productId !== null,
  'Supply a request ID, product ID, or both.');

/** Operator diagnostic, never exposed as an agent tool. One read-only SQL snapshot. */
export async function inspectEvidence(
  database: Pick<DatabasePool, 'query'>, context: AppContext,
  selector: z.infer<typeof EvidenceSelector>,
) {
  const ctx = validate(AppContextSchema, context);
  if (ctx.role !== 'editor') throw new DomainError('FORBIDDEN', 'Evidence inspection requires an authorized operator.');
  const args = validate(EvidenceSelector, selector);
  try {
    const result = await database.query(`WITH receipts AS (
      SELECT * FROM operation_receipts
      WHERE tenant_id = $1 AND ($2::uuid IS NULL OR request_id = $2)
        AND ($3::uuid IS NULL OR result->>'id' = $3::text)
    ), audits AS (
      SELECT * FROM audit_logs
      WHERE tenant_id = $1 AND ($2::uuid IS NULL OR request_id = $2)
        AND ($3::uuid IS NULL OR product_id = $3)
    ) SELECT
      (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY created_at, request_key), '[]'::jsonb)
       FROM receipts r) AS receipts,
      (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY (after_data->>'version')::int, created_at, id), '[]'::jsonb)
       FROM audits a) AS audits,
      (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id), '[]'::jsonb)
       FROM products p WHERE tenant_id = $1 AND ($3::uuid IS NULL OR id = $3)
         AND ($2::uuid IS NULL OR id IN (SELECT product_id FROM audits)
           OR id::text IN (SELECT result->>'id' FROM receipts))) AS products`,
    [ctx.tenantId, args.requestId, args.productId]);
    const { receipts, audits, products } = result.rows[0] as {
      receipts: any[]; audits: any[]; products: any[];
    };
    const linkedReceipts = receipts.map(receipt => ({ ...receipt,
      matchingAuditIds: audits.filter(audit => audit.request_id === receipt.request_id
        && audit.actor_id === receipt.actor_id && audit.action === receipt.operation
        && audit.product_id === receipt.result.id && isDeepStrictEqual(audit.after_data, receipt.result))
        .map(audit => audit.id),
    }));
    return { tenantId:ctx.tenantId, selector:args, receipts:linkedReceipts, audits, products,
      interpretation:receipts.length || audits.length
        ? 'Matching application evidence found. Receipt results are historical; products are current at this snapshot.'
        : 'No matching evidence is visible in this tenant snapshot. This alone does not prove an operation never happened.' };
  } catch {
    throw new DomainError('DATABASE_ERROR', 'Evidence lookup failed. The operation outcome remains unconfirmed; do not retry a write blindly.');
  }
}
