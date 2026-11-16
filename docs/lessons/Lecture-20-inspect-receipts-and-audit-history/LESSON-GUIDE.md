# Lecture 20: Inspect receipts and audit history

## Objective

Investigate an operation using request ID, product ID, receipt and audit event, including a model failure after database commit.

**Checkpoint:** Students can establish what happened from application evidence.

## Before you start

Work through Lecture 19 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/evidence.ts`
- `scripts/inspect-operation.ts`
- `tests/evidence.test.ts`
- `src/tools.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- A receipt records an operation result; an audit records its change; the current product can be newer than either.
- Inspection requires editor host context and a separate operator database connection with SELECT on the three tables.
- An empty inspection does not prove an operation never happened. Verify scope and identifiers.
- A committed transaction survives a later model or notification failure. Reconcile evidence before retrying.

## Practice and verify

From database-crud-agent, install once with `npm ci`. Run:

```sh
npm run test:evidence
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
