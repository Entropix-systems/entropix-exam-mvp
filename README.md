# ExamOS by Entropix Systems

A tenant-safe examination operating system demo built as a pnpm monorepo with a React web app,
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
pnpm seed:demo:full-application  # guarded full role + historical journey seed
pnpm smoke:demo:full-application # read-only seeded structure/business gate
pnpm test:demo:roles      # live credential matrix + focused authorization tests
pnpm test:demo:journey    # Cedar and Northstar persisted student journeys
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

## Full-application demo data

For a disposable local database, run the normal migrations and then:

```bash
pnpm seed:demo:full-application
pnpm smoke:demo:full-application
pnpm test:demo:roles
pnpm test:demo:journey
pnpm test:demo:bulk-imports
```

The full seed refuses `NODE_ENV=production`, provisions only fictional
`example.test` identities, and prints a target preflight without credentials,
tokens, hashes, or connection strings. Local mutation is allowed only when the
database is named `exam_mvp` on port `55432` (or the explicit local name/port
overrides). Every other fictional demo target requires both an explicit target
category and the exact host:port/database acknowledgement:

```bash
DEMO_SEED_TARGET=shared DEMO_SEED_ACK=<host:port>/<exact-database-name> \
  pnpm seed:demo:full-application
```

Do not run that shared-target command until the named database and authorization
have been independently confirmed. The verified role accounts and intentional
public test password are tracked in
`docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md`.

Bulk student-import files are under `fixtures/imports/bulk/`: clean 12-row files
for Northstar and Cedar plus an intentionally invalid reconciliation file. The
existing 100-row Northstar and 20-row Cedar CSVs remain the authoritative baseline
seed inputs. Preview bulk uploads before commit, and use a disposable local
database when later checks depend on the original roster counts.

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

## Free demo deployment

The production demo uses the same GitHub monorepo for two independently filtered
deployments:

```text
examos.entropixsystems.com            Vercel Vite static site
  /api/*                              proxied by Vercel
entropix-exam-mvp.onrender.com        Render NestJS Web Service
entropix-exam-mvp-staging             Supabase PostgreSQL
```

Both hosting projects must use the repository root so `pnpm-workspace.yaml`, the
lockfile, and shared `packages/*` remain available. `vercel.json` builds only
`@entropix/web` and publishes `apps/web/dist`. `render.yaml` builds only
`@entropix/api` and its workspace dependencies. The worker is intentionally not
deployed for the demo because its runtime currently exposes only foundation
health endpoints.

Create the Render service from `render.yaml`, then configure the three values
marked `sync: false` in the Render dashboard:

```text
DATABASE_URL           restricted exam_app Supabase session-pooler URL
ACCESS_TOKEN_SECRET    independent random secret, at least 32 characters
REFRESH_TOKEN_PEPPER   different random secret, at least 32 characters
```

Download the Supabase server root certificate and add it to the Render service
as a secret file named `supabase-ca.crt`. Render mounts it at
`/etc/secrets/supabase-ca.crt`; `DATABASE_SSL_CA_PATH` in `render.yaml` points
the API at that file and the database client verifies the server certificate.
Because the client supplies SSL options explicitly, keep `sslmode`, `sslcert`,
`sslkey`, and `sslrootcert` out of `DATABASE_URL`; node-postgres otherwise
replaces the configured CA object while parsing the URL.

Do not give the runtime service `DATABASE_MIGRATION_URL`. Apply committed
migrations separately with the migration role, verify migration status, and
only then deploy the API. Seed the shared fictional demo target only with the
guarded `DEMO_SEED_TARGET=shared` acknowledgement documented above.

Keep Render on its generated `entropix-exam-mvp.onrender.com` hostname. In
Vercel, add `examos.entropixsystems.com` to the Web project and create the exact
CNAME record Vercel displays in Cloudflare with proxying disabled until Vercel
verifies the domain and provisions TLS.

The Web app keeps `VITE_API_BASE_URL=/api/v1`. Do not point the browser directly
at Render: Vercel's `/api/*` rewrite preserves the same-origin secure-cookie
authentication contract and avoids adding a cross-origin CORS path.

For branch, lock, contract, and verification rules, read `AGENTS.md` and the
current files under `docs/codex/` relevant to your task.
