# Lecture 07: Search and paginate

## Objective

Search names and SKUs with stable ordering, bounded pagination and literal handling of percent and underscore characters.

**Checkpoint:** Search results and page boundaries behave predictably.

## Before you start

Work through Lecture 06 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
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

- Page size is 1–50; offset is 0–10000.
- Escape LIKE metacharacters so user search text remains literal.
- Fetch limit plus one to compute nextOffset, returning only the requested page size.

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
