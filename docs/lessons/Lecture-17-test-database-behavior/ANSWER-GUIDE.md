# Lecture 17 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Run the repository suite and identify an assertion for each checkpoint category.

npm run test:database runs 18 tests. Read tests/repository.test.ts for CRUD, cross-tenant access, reader denial, stale versions, exact replay, literal SQL-like strings, page boundaries and rollback.

## Exercise 2

Why must an audit failure also remove the attempted product change?

The mutation, audit and receipt share one transaction. A forced audit insertion failure must roll back every stored effect and release the client.

## Exercise 3

Does passing PGlite prove real-server concurrency?

No. Use the optional six-test ephemeral PostgreSQL suite for multiple-connection locks, privileges and conditional decision SQL.

