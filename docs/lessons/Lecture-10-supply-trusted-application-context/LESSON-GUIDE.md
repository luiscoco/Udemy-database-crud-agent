# Lecture 10: Supply trusted application context

## Objective

Supply tenantId, userId, role and a fresh requestId from host context. Keep identity outside tool parameters and preserve request identity through approval and resumption.

**Checkpoint:** Model-generated identity claims cannot alter the authorization context.

## Before you start

Work through Lecture 09 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/domain.ts`
- `src/config.ts`
- `src/tools.ts`
- `src/cli.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Local demo environment identity is a fixture, not deployed authentication.
- Create a fresh request ID per accepted user turn, not per tool call.
- The same context accompanies paused and resumed execution.

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
