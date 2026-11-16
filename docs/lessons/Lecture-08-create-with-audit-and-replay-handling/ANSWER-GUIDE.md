# Lecture 08 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Compare identical creation within one request and creation under a new request ID.

Same normalized call and request returns replayed:true. A new request attempting the same SKU is a new operation and receives SKU_EXISTS.

## Exercise 2

Explain the outcome if audit insertion fails.

The transaction rolls back the product mutation and no receipt is committed. A bounded database error is returned.

