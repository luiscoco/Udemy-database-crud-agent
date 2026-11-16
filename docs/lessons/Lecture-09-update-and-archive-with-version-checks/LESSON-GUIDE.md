# Lecture 09: Update and archive with version checks

## Objective

Update and archive active products using expectedVersion. Preserve null fields and commit each successful mutation with its audit and receipt.

**Checkpoint:** A stale proposal cannot overwrite a newer product version.

## Before you start

Work through Lecture 08 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/domain.ts`
- `src/repository.ts`
- `tests/repository.test.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Null means unchanged; zero remains a valid supplied numeric value.
- A successful mutation increments version; a stale expectedVersion fails.
- Archive sets deleted_at and hides the stored row from normal reads.

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
