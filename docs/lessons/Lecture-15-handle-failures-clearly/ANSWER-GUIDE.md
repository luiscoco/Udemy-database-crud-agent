# Lecture 15 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

An update fails with CONFLICT. What is the next safe sequence?

Explain that the reviewed version was stale; retrieve the current product, clarify the intended change if needed, and obtain approval for a new exact proposal before another write.

## Exercise 2

A reader is accidentally approved by the host. Predict the result.

The repository independently checks editor authority and returns FORBIDDEN. No product, receipt or audit mutation commits.

## Exercise 3

A user rejects creation. Can the assistant say it was created?

No. Explain the rejection and unchanged database. A later write needs a new explicit proposal and review.

