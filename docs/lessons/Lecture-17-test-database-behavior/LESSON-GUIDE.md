# Lecture 17: Test database behavior

## Objective

Run deterministic CRUD, tenant isolation, reader restriction, stale-version, duplicate-call, literal-search, pagination and audit-rollback tests.

**Checkpoint:** Database correctness can be checked without an LLM.

## Before you start

Work through Lecture 16 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `tests/repository.test.ts`
- `src/repository.ts`
- `src/domain.ts`
- `sql/001_init.sql`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- The 18 repository tests execute production repository SQL in isolated PGlite, without provider inference.
- Assert stored products, audits and receipts, not only returned text.
- PGlite is useful for deterministic SQL checks. Real PostgreSQL grants and concurrent connections are tested separately in Lecture 21.

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
