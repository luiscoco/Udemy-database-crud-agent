# Lecture 19 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Compare a missing-price case with a denied-change case.

Missing required data should lead to clarification before a write proposal. Denial should resume the rejected interruption, produce zero new stored effects, and explain that the operation was not performed.

## Exercise 2

Design an ambiguity assertion.

Seed two plausible matches. Require clarification or an explicit exact product selection; assert no write occurs merely from a vague product description.

## Exercise 3

Run a new live evaluation only if you choose to use your provider account.

Configure your own OPENAI_API_KEY in .env, then npm run eval:live. This incurs provider usage. Compare new traces and actual database snapshots, not just the final answer.

