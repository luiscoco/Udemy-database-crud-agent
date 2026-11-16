# Lecture 16 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Create a product, reset the conversation, then search for it.

The product remains committed. Reset affects only conversation history; the subsequent search uses the same trusted identity and a fresh request ID.

## Exercise 2

The model fails after a committed write. What should the host do?

Do not infer rollback. Show the request ID and stored-operation warning, clear unreliable conversation state, and use receipts/audit inspection to establish the outcome.

## Exercise 3

Compare request identity before and after approval.

The resumed interruption uses the original request ID. A separate later user message receives a newly minted ID.

