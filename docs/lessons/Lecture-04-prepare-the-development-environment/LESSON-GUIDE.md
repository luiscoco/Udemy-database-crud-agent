# Lecture 04: Prepare the development environment

## Objective

Prepare a TypeScript ESM project with the Agents SDK, Zod, PostgreSQL, strict checking, a dependency lockfile, an environment template and repeatable setup commands.

**Checkpoint:** A student can install the dependencies and run offline checks from the provided instructions.

## Before you start

Work through Lecture 03 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `.env.example`
- `compose.yaml`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- Use npm ci with the lockfile for the pinned dependency set.
- Copy .env.example to .env and supply your own API key for live use.
- Offline SDK/database tests need neither Docker nor an API key.

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
