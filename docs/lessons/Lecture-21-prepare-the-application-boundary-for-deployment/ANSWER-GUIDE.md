# Lecture 21 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

List server-owned pending-state fields.

Preserve original context, owner tenant/actor/session/conversation, exact interruption ID/tool/arguments, SDK and agent revisions, expiry and storage revision. Store encrypted trusted state; never deserialize state supplied by a browser.

## Exercise 2

Run the optional real PostgreSQL tests.

With Python 3 and Docker running, use npm run test:postgres. It creates its own temporary loopback PostgreSQL container, runs six tests, and stops that container. It does not read .env or connect to your configured application database.

## Exercise 3

What remains after the boundary tests pass?

Implement and integration-test real authentication, revocation, transport security, encrypted state storage, key rotation, worker recovery, distributed quotas, backups and retention. The checked reference policies alone do not provide these services.

