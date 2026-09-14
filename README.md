# Entropix Examination ERP MVP

A tenant-safe Examination ERP demo built as a pnpm monorepo with a React web app,
NestJS API, worker, PostgreSQL/Prisma persistence, shared contracts, and pure
domain rules.

The current demo journey covers institution setup, academics, students,
registration, scheduling, conduct, marks approval, persisted result runs,
publication, withdrawal, and current student result visibility.

## Prerequisites

- Node.js `24.20.0` (pinned in `.nvmrc`)
- pnpm `12.3.4` through Corepack
- Docker Desktop with Compose

## First-time local setup

1. Clone the repository and enter it.

   ```bash
   git clone <repo-url>
   cd entropix-exam-mvp
   ```

2. Use the pinned runtime and install dependencies.

   ```bash
   nvm install
   nvm use
   corepack enable
   pnpm install --frozen-lockfile
   ```

3. Create local environment files.

   ```bash
   cp .env.example .env
   cp .env.docker.example .env.docker
   ```

   Replace every `change-me-*` value. The `exam_app` and `exam_migration`
   passwords in `.env` must match `EXAM_APP_PASSWORD` and
   `EXAM_MIGRATION_PASSWORD` in `.env.docker`. Never commit either local file.

4. Start local infrastructure.

   ```bash
   pnpm infra:up
   ```

5. Generate the Prisma client, apply all migrations, and load fictional demo
   data for Northstar College and Cedar School.

   ```bash
   pnpm setup:local
   ```

6. Start the web app, API, and worker.

   ```bash
   pnpm dev
   ```

   The defaults are web `http://localhost:5173`, API
   `http://localhost:3000/api/v1`, and worker port `3001`.

## Common commands

```bash
pnpm db:generate          # regenerate the Prisma client
pnpm db:migrate:deploy    # apply committed migrations
pnpm db:migrate:status    # inspect migration status
pnpm seed:demo            # idempotent fictional seed chain
pnpm typecheck            # workspace type checks
pnpm build                # workspace production builds
pnpm test                 # workspace tests
pnpm lint                 # workspace lint
pnpm verify:b03           # focused Result Runs & Publication checks
pnpm verify:b04           # focused student portal and document checks
pnpm smoke:results-flow   # mutating B03 flow; use a disposable local DB only
pnpm smoke:student-portal # read-only scoped portal check against current data
pnpm d0:verify            # broad foundation/integration gate
pnpm dev:stop             # stop repository dev processes
pnpm infra:down           # stop local containers
```

`pnpm smoke:results-flow` creates and publishes fictional result snapshots,
withdraws them, and republishes a corrected version. Do not point that command at
the shared demo or production database.

## Repository layout

```text
apps/web              React browser application
apps/api              NestJS REST API
apps/worker           background worker foundation
packages/contracts    shared DTOs, enums, and IDs
packages/domain       deterministic examination rules
packages/db           Prisma schema, migrations, RLS, and seed/smoke scripts
packages/storage      private document storage lifecycle
packages/notifications email abstraction
docs/codex            shared engineering context and handoffs
docs/design/index.html practical demo UX reference
```

## Database safety

Local runtime access uses the restricted `exam_app` role. Migrations use
`exam_migration`. Tenant-owned tables enforce PostgreSQL row-level security;
application code must use the established tenant transaction helper. Do not use
the bootstrap or migration role as the running API/worker identity, and do not
manually patch a database to make the demo work.

For branch, lock, contract, and verification rules, read `AGENTS.md` and the
current files under `docs/codex/` relevant to your task.
