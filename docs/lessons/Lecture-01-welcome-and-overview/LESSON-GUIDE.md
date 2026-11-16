# Lecture 01: Welcome and Overview

## Objective

Understand the product-management agent, its database boundary, and the learning path.

**Checkpoint:** You can explain what the agent proposes and what the application authorizes and stores.

## Before you start

Begin here; no prior lecture is required. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/domain.ts`
- `src/tools.ts`
- `src/repository.ts`
- `src/approval.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- The model selects tools; trusted host context supplies identity.
- Typed arguments, operator approval, repository authorization and database constraints protect different boundaries.
- A successful answer is useful only when it agrees with the actual tool result and stored evidence.

## Practice and verify

From database-crud-agent, install once with `npm ci`. Run:

```sh
npm run check
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
