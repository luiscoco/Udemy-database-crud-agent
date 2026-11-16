# Lecture 03: Define the agent’s business contract

## Objective

Map search, retrieve, create, update and archive requests to five explicit tools. Specify clarification rules, supported operations and business constraints.

**Checkpoint:** Every supported request has a clear tool path; incomplete and unsupported requests have explicit outcomes.

## Before you start

Work through Lecture 02 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/domain.ts`
- `src/agent.ts`
- `src/tools.ts`
- `examples/business-contract.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- The model selects business tools; it never receives an arbitrary SQL tool.
- Prices are integer EUR cents; stock is a bounded nonnegative integer.
- Archive hides an active product without physically deleting its row.

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
