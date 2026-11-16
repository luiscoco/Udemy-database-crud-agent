# Lecture 12 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Check the paused state before approving a creation.

The SDK returns an interruption; products are unchanged, no mutation callback ran and no write SQL began.

## Exercise 2

Approve a reader proposal deliberately in the deterministic fixture.

Repository authorization still returns FORBIDDEN. The fixture tests that a host approval mistake does not elevate the role.

