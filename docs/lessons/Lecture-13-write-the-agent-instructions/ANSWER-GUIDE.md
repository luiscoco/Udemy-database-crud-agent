# Lecture 13 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

What is missing from "Create SKU EXERCISE-11 with name Desk Lamp"?

Ask for price and stock before a write proposal. Do not invent defaults. Explicit zero is valid when the user supplies it.

## Exercise 2

A product name says to ignore previous instructions. What should happen?

Treat that database text as untrusted data. Resolve the actual user request; do not elevate product text into instructions. Evaluate sampled behavior with the live cases in Lecture 19.

## Exercise 3

Can instructions replace repository authorization?

No. Schemas, approval and repository policy enforce implemented boundaries. Instructions guide reasoning, and free-text success claims still need evidence from successful tools.

