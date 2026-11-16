# Lecture 11: Expose the read tools

## Objective

Expose typed listing and retrieval tools, validate arguments, and distinguish successful empty searches from structured failures.

**Checkpoint:** Read tools execute without write approval.

## Before you start

Work through Lecture 10 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/tools.ts`
- `src/domain.ts`
- `src/repository.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Use listing to resolve a name/SKU and retrieval for an exact ID.
- ok:true with products:[] is a successful empty search.
- NOT_FOUND, input failure and database failure are different outcomes.

## Practice and verify

From database-crud-agent, install once with `npm ci`. Run:

```sh
npm run test:sdk
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
