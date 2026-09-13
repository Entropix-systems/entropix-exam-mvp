# SESSION HANDOFF — DEV A

Last updated: 2026-09-13
Branch: d1-a-academic-masters
Base: 7ef9edd
Head: 7ef9edd (A01 changes are uncommitted)

## Current Sprint Goal

Working Examination ERP demo for Tuesday, with persisted academic masters now
available for the first business flow.

## Lane Ownership

Developer A owns:

- academic masters
- students, faculty, enrolments, and demo import
- exams and registration
- timetable, halls, seats, duties, attendance, and incidents

Developer B owns:

- result rules
- marks entry and independent review
- result runs and publication
- student outputs, dashboard, reports, and demo polish

## Completed in This Lane

- A01 implements Campus, Department, Program, AcademicYear, Term, Cohort, and
  Subject as tenant-owned Prisma models with composite same-tenant relationships,
  scoped uniqueness, checks, RLS, and restricted runtime access.
- Migration `20260913150000_academic_masters` was applied to the configured demo DB.
- Northstar College and Cedar School academic fixtures were persisted idempotently.
- Authenticated API routes provide snapshot/get/create/update behavior under
  `/api/v1/academics`; tenant scope comes only from IAM actor context.
- The Setup & access page renders persisted institution, calendar, hierarchy,
  department, subject, and stable UUID data.
- Shared academic contracts and repository setup/contract documentation are current.

These changes are not yet committed or merged into `integration`.

## Current Task

Task: A01 — Academic Masters
Status: IMPLEMENTED AND FOCUSED VERIFIED; AWAITING REVIEW/COMMIT/MERGE

What works:

- Both fictional tenant structures persist and reload from PostgreSQL.
- Missing tenant context sees zero academic rows.
- Northstar context cannot read a Cedar Subject UUID or create a Department using
  Cedar's Campus UUID.
- Institution administrators can create/update academic masters; tenant users can
  read their own snapshot; platform context and non-admin writes are denied.
- Invalid resource paths, UUIDs, names/codes, hierarchy, credits, sequence, and
  date order are rejected through Nest exceptions and the standard API envelope.

## Stable Context for Next Session

The next agent may assume:

- IAM actor-context resolution remains unchanged and is reused by Academics.
- A01 owns exactly one migration and no alternate academic schema exists.
- Academic delete is intentionally absent so referenced history cannot be removed.
- The configured remote demo DB has all four repository migrations applied.
- No repository-managed demo password exists; do not fabricate or overwrite IAM
  credentials merely to obtain browser proof.

## Shared Contracts / Schema That Matter

- `packages/contracts/src/academics.ts` defines resource paths, records, inputs,
  `AcademicStructureSnapshot`, `AcademicInputByResource`, and
  `AcademicRecordByResource`.
- Stable downstream references are `Term.id`, `Cohort.id`, and `Subject.id` UUIDs.
- API routes are GET snapshot, GET by resource/id, POST by resource, and PUT by
  resource/id. Request bodies never contain authoritative tenant scope.
- A01 Departments are now the source IAM must consume in a focused follow-up for
  department-scoped grants; IAM must not define another Department model.

## Migrations

Latest migration:

- `20260913150000_academic_masters`

Migration lock:

- Developer A retains it until A01 is committed and merged.

Live state:

- `prisma migrate deploy` applied pending IAM Phase 3 and A01 migrations.
- Final `pnpm --filter @entropix/db migrate:status` reported the schema up to date.

## Shared Contract Lock

Owner:

- Developer A.

Relevant shared contract change:

- Academic record/request/snapshot contracts are implemented and documented.
- Keep the lock through A01 review/merge, then explicitly release or transfer it.

## Files / Modules to Continue From

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260913150000_academic_masters/migration.sql`
- `packages/db/scripts/seed-academics.ts`
- `packages/db/scripts/academic-rls-smoke.ts`
- `packages/contracts/src/academics.ts`
- `apps/api/src/modules/academics/`
- `apps/web/src/academics/academics-client.ts`
- `apps/web/src/pages/academic-structure.tsx`
- `apps/web/src/pages/setup-access-page.tsx`
- `docs/codex/CONTRACTS.md`
- `docs/codex/CURRENT-STATE.md`

## Mockup Reference

Relevant mock screen:

- `docs/design/index.html#setup`

Implemented behavior:

- The existing Setup & access structure and terminology are preserved while the
  academic card now loads real Northstar/Cedar tenant data instead of mock state.

## Verified Behavior

- `pnpm --filter @entropix/api exec vitest run src/modules/academics/academics.service.spec.ts` → PASS, 6 tests.
- `pnpm --filter @entropix/web exec vitest run src/academics/academics-client.spec.ts src/pages/academic-structure.spec.tsx src/pages/setup-access-page.spec.tsx` → PASS, 4 tests.
- Contracts, DB, API, and Web focused typechecks/builds → PASS.
- Focused Academics oxlint and changed Web ESLint targets → PASS.
- `pnpm --filter @entropix/db exec prisma validate` → PASS.
- `pnpm seed:academics` → PASS for Northstar College and Cedar School.
- `pnpm --filter @entropix/db smoke:academics` → PASS with Northstar counts
  1/3/1/1/1/1/3, Cedar counts 1/1/1/1/1/1/3, missing-context denial,
  foreign read denial, and foreign-parent mutation rejection.
- Live unauthenticated `GET /api/v1/academics` → 401 standard
  `UNAUTHENTICATED` API error envelope.
- Browser `/setup-access` → meaningful sign-in page, no Vite overlay, non-blank.
- `git diff --check` → PASS.

## Known Limitations / Deferred

- Authenticated Northstar/Cedar browser rendering was not executed because no demo
  password is stored or supplied. Creating a temporary privileged IAM identity was
  rejected and was not bypassed; the unused helper was removed.
- Academic delete is intentionally deferred.
- IAM department-scoped role selection still needs a follow-up to consume A01 data.
- The full repository verification suite was not run, per A01 scope.

## Blockers

- No implementation blocker remains.
- Authenticated manual browser proof requires an existing fictional institution-admin
  credential from the task owner.
- Commit/merge was not authorized in this session.

## Cross-Lane Dependency

Available to downstream lanes after merge:

- Stable `Term.id`, `Cohort.id`, and `Subject.id` values.
- Tenant-safe Academic snapshot and individual record queries.
- A real Department source for the IAM department-grant follow-up.

Required synchronization:

- Review/commit/merge A01, then all dependent branches pull/rebase `integration`
  before consuming the migration or shared contracts.

## Next Exact Action

1. Review `git diff` on `d1-a-academic-masters` and commit the internally consistent A01 slice.
2. Merge through `integration`, then release the migration lock and transfer/release the contract lock.
3. If pre-merge authenticated browser proof is required, supply an existing fictional admin credential and verify `/setup-access` for both tenant slugs.
4. Start the IAM follow-up that reads A01 Departments for scoped role grants.

## Minimal Context Files for Next Session

Required:

1. `AGENTS.md`
2. this `SESSION-HANDOFF.md`
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/CONTRACTS.md`
5. the A01 files listed above

Do not reread the whole repository.
