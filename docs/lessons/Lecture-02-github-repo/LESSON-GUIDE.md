# Lecture 02: github repo

## Objective

Obtain the reference source, install locked dependencies and locate the course modules.

**Checkpoint:** The supplied project installs and passes its offline checks without a provider key.

## Before you start

Work through Lecture 01 first, or use the completed reference to catch up. Node.js 22+ and npm are sufficient for the default offline checks.
Docker, Python and a provider key are required only for the explicitly optional commands
described in the reference README. No private credentials are supplied.

## Read the implementation in this order

- `package.json`
- `package-lock.json`
- `src`
- `tests`
- `evals`
- `sql`

Use the complete files for syntax-colored TypeScript/SQL viewing in your editor.
Read the domain contracts first, follow calls into the implementation, then inspect
the corresponding assertions rather than relying on an assistant's final sentence.

## Key ideas

- This repository contains the full reference source. The Udemy ZIPs provide an offline copy.
- Repository: https://github.com/luiscoco/database-crud-agent. Clone with `git clone https://github.com/luiscoco/database-crud-agent.git`.
- These downloads contain the same completed reference project, not separate historical commits.

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
