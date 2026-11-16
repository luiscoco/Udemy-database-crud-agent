# Lecture 21: Prepare the application boundary for deployment

## Objective

Plan verified server identity, authorized approval decisions, durable pending-state storage, operational limits and real database integration tests.

**Checkpoint:** Students can distinguish the local starter from a deployed service.

## Before you start

Work through Lecture 20 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/deployment-boundary.ts`
- `docs/deployment-plan.json`
- `docs/deployment-pending.sql`
- `tests/deployment-boundary.test.ts`
- `tests/integration/postgres.test.ts`
- `scripts/test_postgres.py`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- The local CLI identity is a fixture. A real server must verify credentials, active membership, role and conversation ownership.
- The reference policies test identity/ownership/freshness checks and actual SDK state round trips. They are not a deployed HTTP service.
- Conditional decision and outbox SQL prevents two conflicting decisions in the tested database transaction. Durable encrypted storage, workers, leases and fencing remain implementation work.
- The schema has repository tenant predicates, not deployed row-level-security policies.

## Practice and verify

From database-crud-agent, install once with `npm ci`. Run:

```sh
npm run test:boundary
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
