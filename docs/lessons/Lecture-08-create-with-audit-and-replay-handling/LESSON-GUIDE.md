# Lecture 08: Create with audit and replay handling

## Objective

Create products for editor context and commit product, audit and operation receipt in one transaction. Replay identical normalized calls inside one host request without duplicate effects.

**Checkpoint:** An identical repeated call in the same request does not create a second effect.

## Before you start

Work through Lecture 07 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/repository.ts`
- `src/domain.ts`
- `sql/001_init.sql`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- The repository requires editor authority independently of the agent.
- The receipt key uses trusted actor/request scope, operation and normalized arguments.
- A new request ID starts a different replay scope.

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
