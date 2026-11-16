# Lecture 04 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Install the project and run its offline checks.

From database-crud-agent, run npm ci and npm run check. Expected: successful TypeScript validation and 112 passing tests.

## Exercise 2

Identify which commands require PostgreSQL and which require an API key.

db:setup, db:seed and demo need the configured PostgreSQL instance. start also needs your own OpenAI API access. test and typecheck are offline.

