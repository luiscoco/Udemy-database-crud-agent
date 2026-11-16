# Lecture 10 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Inspect all five tool schemas for identity parameters.

None accepts tenantId, userId, role or requestId. Tools obtain trusted identity from RunContext instead.

## Exercise 2

Explain why a valid tenant UUID in chat does not authorize access.

Correct formatting is not authentication. The host chooses permitted tenant context and repository predicates enforce it.

