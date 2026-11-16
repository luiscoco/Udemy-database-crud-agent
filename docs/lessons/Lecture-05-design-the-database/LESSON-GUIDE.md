# Lecture 05: Design the database

## Objective

Create products, audit_logs and operation_receipts tables with tenant-scoped SKU uniqueness, nonnegative values, versions, timestamps and soft deletion.

**Checkpoint:** Database constraints reject invalid rows independently of the model.

## Before you start

Work through Lecture 04 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `sql/001_init.sql`
- `sql/002_runtime_role.sql`
- `scripts/seed.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Product IDs identify rows; tenant IDs define workspace scope.
- SKU uniqueness includes archived products inside the same tenant.
- Mutation, audit and receipt must commit together.

## Practice and verify

From database-crud-agent, install once with `npm ci`. Run:

```sh
npm run test:database
```

For a complete regression check, run `npm run check` (112 tests plus typechecking).
The default suite makes no provider inference calls. Complete EXERCISES.md and compare
your reasoning with ANSWER-GUIDE.md. Optional live/database commands in those exercises
have their own prerequisites; do not substitute them for the deterministic checks.

## Completion checklist

- Explain the checkpoint using concrete source paths and observable results.
- Complete each exercise and compare the answer guide.
- Distinguish proposed, rejected, failed and committed operations.
- Identify which guarantees are implemented and which require additional service code.
