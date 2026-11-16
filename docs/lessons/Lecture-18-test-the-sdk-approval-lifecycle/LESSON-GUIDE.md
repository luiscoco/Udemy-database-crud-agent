# Lecture 18: Test the SDK approval lifecycle

## Objective

Use a scripted model with the actual SDK execution pipeline to assert zero writes before approval, zero after rejection, and one after approval, including malformed inputs and identity injection.

**Checkpoint:** Approval behavior is demonstrated through executable tests.

## Before you start

Work through Lecture 17 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `tests/agent.test.ts`
- `tests/approval-lifecycle.test.ts`
- `tests/helpers/approval-fixture.ts`
- `src/approval.ts`
- `src/tools.ts`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- A scripted model makes tool selection repeatable while exercising the actual SDK runner and interruptions.
- Count callback and persisted effects at the pause, after rejection, and after resumption.
- Malformed arguments and extra identity fields must not become authorized repository writes.

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
