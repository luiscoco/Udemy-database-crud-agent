# Lecture 06: Retrieve one product

## Objective

Retrieve an active product by UUID using trusted tenant context, parameterized SQL and safe unavailable-record errors.

**Checkpoint:** Another tenant cannot retrieve a product merely by knowing its ID.

## Before you start

Work through Lecture 05 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/repository.ts`
- `src/domain.ts`
- `tests/repository.test.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Validate a UUID at runtime before querying.
- The query constrains tenant, ID and active status.
- NOT_FOUND does not disclose whether a row exists in another workspace.

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
