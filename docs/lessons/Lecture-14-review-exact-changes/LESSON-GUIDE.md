# Lecture 14: Review exact changes

## Objective

Show the pending tool, parsed arguments, current product and proposed values. Decide the exact interruption, resume the same state, and default unclear answers to rejection.

**Checkpoint:** The operator can see precisely what will execute.

## Before you start

Work through Lecture 13 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/approval.ts`
- `src/cli.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Creation shows current:null; update expands retained fields into proposed values.
- Archive describes inactive state and next version; its timestamp is set at execution.
- Only trimmed lowercase approve authorizes; other answers and I/O failures reject.

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
