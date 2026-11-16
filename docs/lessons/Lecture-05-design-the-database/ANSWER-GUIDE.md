# Lecture 05 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Locate the nonnegative price and stock constraints.

Read the CHECK constraints in sql/001_init.sql and the rejection cases in tests/repository.test.ts. Constraints operate independently of model instructions.

## Exercise 2

Explain why archive does not free an existing SKU.

The row and tenant/SKU uniqueness remain stored after deleted_at is set. This starter has no restore or SKU-reuse operation.

