# Lecture 12: Expose the write tools

## Objective

Expose create, update and archive as typed approval-gated tools. Keep editor authorization in the repository and use expectedVersion for update/archive.

**Checkpoint:** A proposed write pauses before database execution.

## Before you start

Work through Lecture 11 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/tools.ts`
- `src/repository.ts`
- `src/approval.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Calling a write tool proposes an operation; it does not yet execute its callback.
- Approval does not grant an editor role or bypass version checks.
- A rejected interruption must not execute a mutation.

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
