# Build a Database AI Agent: TypeScript and PostgreSQL

Completed reference application for the Udemy course. Start with the setup below, then
use [the course outline](docs/COURSE-OUTLINE.md) and the [lecture guides](docs/lessons/README.md).
The guides all refer to this final implementation; they are not historical Git checkpoints.
Udemy lecture numbers 3–22 correspond to technical lessons 1–20. Internal fixture names
and generated `dist/lesson17`, `dist/lesson19` paths use the original technical numbering.

## Install and verify (no API key or Docker)

Use Node.js 22 or newer and npm. Open a terminal in this directory:

```sh
npm ci
npm run check
```

Expected: successful strict TypeScript check and 112 passing tests. Tests use scripted
SDK models and isolated PGlite; they make no provider inference calls. Internet access
may be needed for the initial dependency installation. package-lock.json pins versions.

Focused commands: `npm run test:database` (18), `npm run test:sdk` (35),
`npm run test:evidence` (12), `npm run test:boundary` (13),
`npm run test:port` (32), plus two evaluation-grader tests in the full suite.
Do not add these focused counts to 112: they partition the same full test suite.

## Optional local PostgreSQL application

Copy the environment template to .env: PowerShell `Copy-Item .env.example .env`,
macOS/Linux `cp .env.example .env`. With Docker and Compose running:

```sh
docker compose up -d --wait
npm run db:setup
npm run db:seed
npm run demo
```

These commands create/seed/change the configured local database. The template binds
PostgreSQL to loopback port 55432 and contains public local demonstration passwords.
Use a disposable course database. Setup uses owner credentials; application operations
use the restricted inventory_app role. Existing data persists in a Docker named volume.
`docker compose down` stops the service while retaining its volume.

For an interactive model, set your own OPENAI_API_KEY in .env and an available tool-capable
OPENAI_MODEL. `npm start` runs the OpenAI Agents adapter; `npm run start:ai` runs AI SDK.
These optional commands incur provider usage. Do not commit your .env or share your key.
Try: "List products", then "Create SKU STUDENT-01 named Desk Lamp, price EUR 24.99,
stock 5". Review the exact proposal. Only the trimmed exact lowercase `approve` permits
that interruption. Every other answer rejects. `/reset` clears conversation history;
it does not undo database changes. `/quit`, `/exit` and EOF release connections.

## Optional evidence, real database tests and live evaluation

`npm run inspect -- --request <actual-request-UUID>` needs DATABASE_INSPECT_URL configured
with a separate operator connection having SELECT on products, audit_logs and
operation_receipts. You may also supply `--product <actual-product-UUID>`. Replace the
placeholders; the normal runtime role cannot read audit_logs. Host identity must be editor.

`npm run test:postgres` requires Python 3 and a running Docker engine. It creates and
removes its own ephemeral PostgreSQL 17 container, executes six integration tests and
writes results to dist/lesson19. It never loads .env or uses the application database.

`npm run eval:live` is optional and incurs provider usage. It requires your own key,
uses synthetic PGlite data, and writes 15-case traces under dist/lesson17. Grade model
decisions separately from stored application effects. Recorded evidence in the separate Udemy student downloads is historical; it is not a fresh
run of your environment or a universal safety guarantee.

## Project map and implemented scope

- src/domain.ts, repository.ts: contracts, parameterized SQL, tenant/editor policy,
  expectedVersion, atomic mutation/audit/receipt and exact replay within request scope.
- src/tools.ts, agent.ts, inventory-instructions.ts: original SDK tools and instructions.
- src/approval.ts, conversation.ts, cli.ts: exact-call review, history, bounds and cleanup.
- src/evidence.ts and scripts/inspect-operation.ts: application evidence inspection.
- src/deployment-boundary.ts and docs/deployment-*: reference policies and deployment gaps.
- src/ai-sdk: second framework adapter with the same application contract.
- tests, evals, sql: executable tests, optional live evaluation and database migrations.

Values use integer cents and nonnegative stock. Null update fields mean unchanged;
zero is valid. Archive is soft deletion; archived SKUs remain reserved within the tenant.
Exact replay is scoped to the actor/request/operation/normalized arguments; it is not
a cross-turn exactly-once guarantee. Database text is untrusted data. A later model
failure cannot roll back a committed transaction; inspect evidence before retrying.

This is a local teaching application. Demo environment identity is not authentication.
Real token verification, encrypted durable pending state, HTTP ownership enforcement,
distributed limits, worker recovery, TLS and operational deployment remain work described
in docs/deployment-plan.json. No row-level-security policy is enabled by this starter.

## Troubleshooting

- Check `node --version` if installation or ESM execution fails; use Node 22 or newer.
- Run commands inside database-crud-agent, not the enclosing lecture directory.
- For database connection errors, verify Docker is running and port 55432 is available.
- For live authentication/model errors, check your own local provider key/model access.
- A CONFLICT means the reviewed version is stale: read current state and review a new proposal.
- A failed model response is not proof a write failed. Inspect its original request ID.

## Repository

https://github.com/luiscoco/database-crud-agent

Clone with `git clone https://github.com/luiscoco/database-crud-agent.git`, then `cd database-crud-agent`.
The repository contains application source, tests and student documentation.
