# Lecture 20 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Trace one synthetic request through receipt, audit and product.

Match trusted tenant, actor, request, operation and product ID. Compare the receipt result and audit after-state; describe current state separately if its version advanced.

## Exercise 2

Why can the normal runtime connection not inspect all evidence?

The restricted runtime role can insert audit events but cannot read them. Configure DATABASE_INSPECT_URL for a separate operator connection; never pass it to the model.

## Exercise 3

How do you invoke the inspection CLI?

With a valid .env and operator connection: npm run inspect -- --request <actual-request-UUID> --product <actual-product-UUID>. Supply at least one selector, replacing the placeholders with real UUIDs.

