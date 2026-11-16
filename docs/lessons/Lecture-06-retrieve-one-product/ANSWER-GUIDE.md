# Lecture 06 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Locate each predicate in the repository get query.

tenant_id comes from host context, id comes from the validated business input, and deleted_at IS NULL excludes archived rows.

## Exercise 2

Compare malformed ID and another-tenant ID outcomes.

Malformed input is validation failure. A valid unavailable ID produces NOT_FOUND with a bounded workspace message.

