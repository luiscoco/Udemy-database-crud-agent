# Lecture 22: Port the agent to another framework

## Objective

Keep database schema, repository contract and deterministic tests. Replace tool definitions and execution adapter, then run shared acceptance scenarios.

**Checkpoint:** Students understand which parts belong to the application and which belong to the SDK.

## Before you start

Work through Lecture 21 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `src/ai-sdk/tools.ts`
- `src/ai-sdk/adapter.ts`
- `src/ai-sdk/cli.ts`
- `src/inventory-instructions.ts`
- `tests/framework-port.test.ts`
- `tests/helpers/framework-fixture.ts`
- `docs/framework-port.json`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- The second implementation uses the AI SDK. Both adapters call the same application repository and strict business schemas.
- The 32 focused tests include 31 shared scenarios exercised through both SDKs, plus byte-preservation checks for 11 existing core files.
- Compare normalized stored business effects. Native malformed-input and unknown-tool error paths can differ while both preserve zero writes.
- Scripted model output demonstrates adapter control flow, not the quality of live model reasoning.

## Practice and verify

From database-crud-agent, install once with `npm ci`. Run:

```sh
npm run test:port
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
