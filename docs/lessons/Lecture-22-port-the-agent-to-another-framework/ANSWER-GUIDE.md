# Lecture 22 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Run the shared acceptance suite.

npm run test:port runs 32 tests, including 31 scenarios through each framework. No provider calls are made; inspect both tool traces and normalized database effects.

## Exercise 2

Which application rules must survive a framework migration?

Tenant and editor policy, strict business inputs, expectedVersion, atomic audit/receipt storage, exact-call review, safe errors and the deterministic repository contract.

## Exercise 3

Compare the native extra-identity argument behavior.

OpenAI can emit an interruption rejected by host preview; AI SDK rejects the input before approval. Both must execute zero repository mutations. Optional live CLIs are npm start and npm run start:ai.

