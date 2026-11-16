# Lecture 15: Handle failures clearly

## Objective

Handle denied approval, insufficient permissions, duplicate SKUs, missing products and version conflicts. Explain the actual outcome and require a newly reviewed proposal after conflict.

**Checkpoint:** Failed or rejected operations are never presented as completed.

## Before you start

Work through Lecture 14 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/domain.ts`
- `src/repository.ts`
- `src/tools.ts`
- `src/approval.ts`
- `tests/approval-lifecycle.test.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Rejection is a decision to perform no mutation; it is not a completed write.
- FORBIDDEN, SKU_EXISTS, NOT_FOUND and CONFLICT communicate distinct safe outcomes.
- After a conflict, retrieve current data and build a fresh proposal. Never automatically resubmit a rejected write.

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
