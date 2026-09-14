# SESSION HANDOFF - DEV B

Last updated: 2026-09-14
Branch: `feat/B03-result-runs-publication`
Base: `9720aea`
Head: current branch tip (B03 implementation and delivery fixes)

## Current Sprint Goal

Deliver the Tuesday demo's marks-to-publication vertical slice. B03 Result Runs
& Publication is implemented and focused-verified against disposable local
PostgreSQL. Its migration is also applied and read-verified on the shared demo
database. Review and integration merge remain.

## Current Task

Task: B03 - Result Runs & Publication
Status: READY FOR REVIEW/MERGE

The controller workflow now:

1. Reads readiness from the real approved roster, submitted conduct state, and
   independently approved marks batches.
2. Blocks computation when required inputs are incomplete.
3. Computes one immutable result run for the current rule/input revision and
   persists subject and student snapshots.
4. Reviews pass/fail/absent/withheld counts and candidate rows on `/results`.
5. Publishes only after rechecking rule version, input revision, checksum, and
   readiness inside a tenant/exam transaction lock.
6. Returns the same publication on retry and preserves exactly one current
   publication per exam.
7. Withdraws with an audit reason, removes student visibility, permits approved
   correction, then creates a new run and monotonically versioned republication.

The student workflow resolves the caller's Student record from the active
membership and returns only that student's current published snapshot. Draft,
historical, and withdrawn results are inaccessible through the student route.

## Shared Contracts / Schema

Migration:

- `packages/db/prisma/migrations/20260914143000_result_runs_publication/migration.sql`
- Adds `ResultRun`, `ResultItem`, `StudentResult`, and `Publication` with
  tenant-safe foreign keys, forced RLS, runtime grants, immutable snapshot
  triggers, and a partial unique index for one current publication per exam.

Typed contracts:

- `packages/contracts/src/results.ts` defines readiness blockers, persisted
  result items/student aggregates/runs, publication records, controller
  snapshot, withdrawal input, and current student result response.

Shared project truth:

- `docs/codex/CONTRACTS.md` records B03 routes and authority/version/privacy
  rules, including conduct-driven input revision invalidation.
- `docs/codex/DECISIONS.md` records DEC-011 for immutable snapshots and the
  single-current versioned publication model.
- `docs/codex/CURRENT-STATE.md` records B03 status and both held locks.

## Locks

- Migration lock: Developer B for B03 until reviewed and merged.
- Shared contract lock: Developer B for B03 until reviewed and merged.
- No competing Result/Publication migration or shared contract should start
  before this branch is integrated or the locks are explicitly transferred.

## Main Files

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260914143000_result_runs_publication/migration.sql`
- `packages/contracts/src/results.ts`
- `apps/api/src/modules/results/`
- `apps/api/scripts/results-flow-smoke.ts`
- `apps/api/src/modules/conduct/conduct.repository.ts`
- `apps/web/src/results/results-client.ts`
- `apps/web/src/pages/results-page.tsx`
- `apps/web/src/pages/workspace-shell.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/App.css`
- `README.md`, `.env.example`, `.env.docker.example`, and package scripts

## Important Adjacent Correction

All result-affecting conduct writes now advance `Exam.inputRevision`. The
focused smoke also exposed an existing Prisma 7 advisory-lock defect in Conduct:
`pg_advisory_xact_lock` returns PostgreSQL `void`, so the call now uses
`$executeRaw`, matching Evaluation and Results, instead of trying to deserialize
the row with `$queryRaw`.

## Verification Evidence

- `pnpm verify:b03` -> PASS (contracts/domain builds, DB/API/Web typechecks,
  API/Web lint, and 2 focused conduct/result files / 14 tests).
- `pnpm --filter @entropix/api build` -> PASS.
- `pnpm --filter @entropix/web build` -> PASS; route-level lazy loading leaves
  all production chunks below 500 kB (main chunk 445.42 kB).
- `pnpm --filter @entropix/db build` -> PASS.
- `pnpm --filter @entropix/api lint` -> PASS.
- `pnpm --filter @entropix/web lint` -> PASS.
- Prisma validate/generate -> PASS.
- Local `prisma migrate deploy` and status -> PASS; all 15 migrations up to date.
- Shared demo `pnpm db:migrate:deploy` -> PASS; applied
  `20260914143000_result_runs_publication`.
- Shared demo `pnpm db:migrate:status` -> PASS; all 15 migrations up to date.
- Documented `pnpm setup:local` -> PASS end-to-end: Prisma generate, no pending
  migrations, and the full fictional academic/people/exam/schedule/conduct/
  evaluation seed chain.
- Full fictional local seed chain through evaluation -> PASS.
- `pnpm smoke:results-flow` against local `exam_app` -> PASS: incomplete-input
  block; real conduct revision increment; stale-run rejection; immutable compute;
  retry-safe publish; exactly one current version; own-current-only student read;
  ABSENT/WITHHELD numeric privacy; withdrawal; corrected recompute/republish.
- Targeted local browser flow on `/results` -> PASS: authenticated Cedar
  controller page, current publication, immutable candidate register, readiness,
  counts, ABSENT/WITHHELD presentation, withdrawal with reason, retry-safe
  compute, and versioned publish all work through UI/API. The final publish
  request returned HTTP 201; no Vite overlay or browser error was detected.
- Read-only shared-demo browser gate on `/results` -> PASS: the route-specific
  Results module loaded with HTTP 200, rendered the empty shared-demo result
  state, and reported no console errors or Vite overlay.
- API startup -> PASS; all six B03 routes mapped.
- `pnpm why pg -r` -> one resolved `pg` version, 8.18.0, for the application and
  Prisma adapter. `pnpm smoke:results-flow` with deprecation tracing -> PASS with
  no concurrent-query warning.

## README / Setup Scripts

The root README now documents pinned runtime installation, local environment
files, Docker infrastructure, migrations, seed chain, app startup, focused and
broad verification, shutdown, repository layout, and restricted-role database
safety. Root scripts now expose `db:generate`, migrate deploy/status,
`seed:demo`, `setup:local`, `verify:b03`, and the explicitly local-only mutating
`smoke:results-flow`. `.env.docker.example` is tracked and contains placeholders
matching the local URLs in `.env.example`.

The workspace pins `pg` 8.18.0 in `packages/db/package.json` and
`pnpm-workspace.yaml` to avoid the Prisma adapter's current warning with newer
`pg` transaction-query behavior. Web routes are lazy-loaded so the production
build no longer emits the existing single-bundle size warning.

## Known Limitations / Deferred

- Result computation is synchronous for MVP; no worker queue is introduced.
- Grade-card PDF generation, spreadsheet result import, moderation committees,
  notifications, analytics, and advanced result history UI remain out of scope.
- The mutating end-to-end browser flow used the ignored fictional credentials
  and disposable local PostgreSQL. The shared-demo check was read-only.

## Blockers

No implementation or deployment blocker. Integration review and merge are the
remaining gates.

## Next Exact Action

1. Review the migration, handwritten Result code, and generated Prisma diff.
2. Merge through `integration`.
3. Release both locks in `CURRENT-STATE.md` and have dependent lanes resync.

## Minimal Context for the Next Session

1. `AGENTS.md`
2. this handoff
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/CONTRACTS.md` - Result Run and Publication section
5. `docs/codex/DECISIONS.md` - DEC-010 and DEC-011
6. `packages/contracts/src/results.ts`
7. `apps/api/src/modules/results/results.repository.ts`
8. `apps/web/src/pages/results-page.tsx`
