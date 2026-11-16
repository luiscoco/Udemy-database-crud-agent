# Lecture 11 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Compare a no-match search with a database error.

No matches returns ok:true with an empty page. A failed operation returns ok:false with a safe error; it is not evidence of empty inventory.

## Exercise 2

Verify valid reads do not require write approval.

Run npm run test:sdk and inspect tests/agent.test.ts. Valid reads return structured results without a write interruption or a stored mutation.

