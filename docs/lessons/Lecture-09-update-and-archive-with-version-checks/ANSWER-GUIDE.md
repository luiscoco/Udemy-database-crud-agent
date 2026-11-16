# Lecture 09 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Read version 1, update stock, then attempt a second update with version 1.

The first update commits version 2. The second returns CONFLICT and cannot overwrite the newer row.

## Exercise 2

Why is an update with all nullable fields set to null invalid?

It requests no supported change. The repository rejects it with VALIDATION_ERROR.

