# Lecture 16: Preserve conversation and bound execution

## Objective

Add supported SDK history, bounded turns, reset and exit commands, resource cleanup and stable authorization across follow-ups.

**Checkpoint:** Follow-up requests work without changing the authorization context.

## Before you start

Work through Lecture 15 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/conversation.ts`
- `src/cli.ts`
- `src/config.ts`
- `tests/approval-lifecycle.test.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- History carries conversation content; tenant, user and role remain host-owned.
- Each accepted user turn gets a new request ID. Approval and resumption retain the original turn context.
- Limits are 8 turns per Runner invocation, 8 approval rounds, 4000 input characters and 120 history items. These are local bounds, not distributed service quotas.
- /reset clears history, not PostgreSQL. /quit, /exit and EOF release resources.

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
