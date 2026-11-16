# Lecture 02 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Run the offline reference project.

Extract the archive, open database-crud-agent, run npm ci and npm run check. Expect a successful typecheck and 112 passing tests.

## Exercise 2

Locate the implementation of create, the SDK adapter and the database schema.

src/repository.ts implements create; src/tools.ts adapts it to OpenAI tools; src/ai-sdk contains the second adapter; sql/001_init.sql defines storage.

