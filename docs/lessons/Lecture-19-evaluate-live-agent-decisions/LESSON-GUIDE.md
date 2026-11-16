# Lecture 19: Evaluate live agent decisions

## Objective

Evaluate clear CRUD requests, missing information, ambiguous products, denied writes, stale versions and malicious database text. Record tool calls, database state and final answers.

**Checkpoint:** Model decision quality is evaluated separately from deterministic application behavior.

## Before you start

Work through Lecture 18 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `evals/cases.ts`
- `evals/live-agent.ts`
- `evals/fixture.ts`
- `evals/grade.ts`
- `evals/trace.ts`
- `tests/live-evaluation.test.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- The 15 live cases use synthetic isolated PGlite data with actual provider inference.
- Application invariants and model decisions are scored separately. A safe rejection can coexist with a poor model decision.
- Recorded results are historical examples, not a guarantee for another model or future run. Heuristic final-answer checks require human interpretation.
- The recorded run was regraded after correcting SDK text-wrapper decoding. Original and corrected summaries are retained; no new inference was used for that correction.

## Practice and verify

From database-crud-agent, install once with `npm ci`. Run:

```sh
node --import tsx --test tests/live-evaluation.test.ts
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
