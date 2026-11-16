# Lecture 07 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Explain the stable ordering and nextOffset calculation.

Rows are ordered by created_at and id. An extra row signals a next page if the bounded offset can continue.

## Exercise 2

Predict what searching for %_ should match.

It matches the literal percent-underscore sequence in name or SKU, rather than expanding to arbitrary characters.

