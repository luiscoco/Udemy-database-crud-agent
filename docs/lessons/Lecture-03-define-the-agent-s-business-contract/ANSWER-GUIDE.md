# Lecture 03 answer guide

Use this after attempting the exercises. Exact generated UUIDs and timestamps may differ.

## Exercise 1

Classify: show keyboards; create a mouse; make the keyboard cheaper; restore an archived item.

Search uses list_products. An incomplete creation needs SKU, name, price and stock. A price change needs an exact product and explicit new price. Restore is unsupported.

## Exercise 2

Explain the difference between user intent and execution authority.

A request describes the desired operation. Host context establishes tenant and actor; repository policy and approval determine whether the write can execute.

