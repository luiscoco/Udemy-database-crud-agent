# Lecture 18 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Run both SDK suites and explain the expected count.

npm run test:sdk runs 35 tests: 19 agent tests and 16 approval-lifecycle tests. No API key is required.

## Exercise 2

Why is a mocked approval Boolean alone insufficient?

It bypasses SDK interruption creation and actual RunState resumption. Exercise real SDK control flow and inspect database state at each boundary.

## Exercise 3

Change a pending argument after preview in a disposable exercise copy.

The host should reject the changed interruption; approval applies to the exact reviewed tool name and arguments.

