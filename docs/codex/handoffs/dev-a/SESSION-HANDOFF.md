# SESSION HANDOFF — DEV A

Last updated: 2026-09-13
Branch: codex/start-enrolments-import-work
Base: b2881a1 (A01 academic masters commit)
Head: b2881a1 (A02 changes are uncommitted)

## Current Sprint Goal

Working Examination ERP demo for Tuesday. Persisted academic masters, students,
faculty, and enrolments now supply the next registration and scheduling slices.

## Lane Ownership

Developer A owns academic masters, students/import, exams/registration, and
examination operations. Developer B owns results, marks, publication, student
outputs, dashboard, and demo polish.

## Completed in This Lane

- A01 academic masters is committed at `b2881a1` on this branch.
- A02 adds tenant-owned Student, Faculty, Enrolment, and StudentImport models
  with same-tenant composite relationships, checks, forced RLS, and stable UUIDs.
- Student and Faculty profiles bind to IAM Membership records; import creates a
  passwordless IAM User/Membership and STUDENT grant when one does not exist.
- CSV preview validates required/malformed fields, duplicate file rolls,
  existing rolls, cohorts, and cohort-compatible subjects with source row numbers.
- Commit revalidates, writes the whole batch transactionally, and uses a
  tenant-scoped server SHA-256 identity for retry-safe replay.
- `withTenant` now accepts optional Prisma transaction timing options; existing
  callers are source-compatible and A02 uses them only for the atomic batch.
- The authenticated People API provides student list/detail, faculty list, and
  student import preview/commit routes.
- `/students` now renders the persisted directory, search, student detail, and
  real CSV preview/commit flow using the mockup terminology and structure.
- Fictional seeds persist Northstar's 100 students and 4 faculty plus Cedar's 20
  students and 3 faculty through the existing fixture sources.

## Current Task

Task: A02 — Students, Faculty, Enrolments & Import
Status: IMPLEMENTED AND FOCUSED VERIFIED; AWAITING REVIEW/COMMIT/MERGE

## Shared Contracts / Schema That Matter

- `packages/contracts/src/people.ts` owns Student/Faculty directory DTOs and
  import preview/commit contracts.
- Stable downstream IDs are `Student.id`, `Faculty.id`, and `Enrolment.id`.
- Enrolment references Student + Cohort + Subject inside one tenant; the Student
  composite key also pins the enrolment cohort to the student's cohort.
- Student-role directory reads include only the profile bound to the current
  authenticated membership.
- Current demo transport is JSON `{ fileName, sourceText }` for CSV. XLSX remains
  deferred because no safe parser already exists in the repository.

## Migrations

Latest migration:

- `20260913170000_people_imports`

Migration lock:

- Developer A retains it through A02 review/merge.

Live state:

- The A02 migration is applied to the configured demo PostgreSQL database.
- `migrate:status` before deployment identified only A02 as pending.

## Shared Contract Lock

Owner: Developer A.

Relevant change:

- A02 People/import DTOs are implemented and documented in `CONTRACTS.md`.
- Retain the lock through review/merge, then release or transfer it before
  another lane changes shared contracts.

## Files / Modules to Continue From

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260913170000_people_imports/migration.sql`
- `packages/db/scripts/seed-people.ts`
- `packages/db/scripts/people-rls-smoke.ts`
- `packages/contracts/src/people.ts`
- `apps/api/src/modules/people/`
- `apps/web/src/people/people-client.ts`
- `apps/web/src/pages/students-page.tsx`
- `docs/codex/CONTRACTS.md`
- `docs/codex/CURRENT-STATE.md`

## Verified Behavior

- `pnpm --filter @entropix/api exec vitest run src/modules/people/people.service.spec.ts` → PASS, 6 tests.
- Contracts, DB, API, and Web focused typechecks/builds → PASS.
- `pnpm --filter @entropix/db exec prisma validate` → PASS.
- `prisma migrate deploy` → A02 migration APPLIED.
- `pnpm seed:people` → PASS twice; the second pass created no duplicate records.
- `pnpm --filter @entropix/db smoke:people` → PASS:
  - Northstar: 100 students, 4 faculty, 300 enrolments, 1 committed import.
  - Cedar: 20 students, 3 faculty, 60 enrolments, 1 committed import.
  - Missing-context reads exposed zero people rows.
  - Northstar could not read a Cedar Student UUID or enrol using a Cedar Subject UUID.
  - Northstar student membership `NS26001` resolved exactly one Student profile.
- Browser `/students` → redirected to meaningful sign-in UI; page had content,
  no framework error overlay, and no captured console errors.

## Known Limitations / Deferred

- XLSX import is deferred; CSV is the working demo path.
- Faculty currently records its primary fixture department while IAM grants retain
  all supplied department scopes. Rich HR/faculty assignment data is deferred.
- Authenticated post-login browser interaction was not executed because no
  repository-managed demo password or reusable session exists. The unauthenticated
  route gate, Web/API builds, and database paths were verified.
- Broad repository verification was not run, per A02 task instructions.

## Blockers

- No implementation blocker remains.
- Authenticated manual `/students` browser proof requires an existing fictional
  institution-admin/controller/student credential from the task owner.
- Commit/merge was not authorized in this session.

## Cross-Lane Dependency

After merge, registration, scheduling, marks, and student-output lanes may consume
stable Student and Enrolment IDs. All dependent branches must pull/rebase
`integration` after the A01+A02 branch is merged.

## Next Exact Action

1. Review the A02 diff and focused validation evidence.
2. Commit the internally consistent A02 slice and merge A01+A02 through `integration`.
3. Release/transfer the migration and contract locks.
4. Start the exam/registration slice against the merged Student/Cohort/Subject IDs.
5. If browser proof is required before merge, supply an existing fictional admin
   credential and verify CSV preview/commit plus student self-view at `/students`.

## Minimal Context Files for Next Session

1. `AGENTS.md`
2. this handoff
3. `docs/codex/generated/A02-students-faculty-enrolments-import.md`
4. `docs/codex/CURRENT-STATE.md`
5. `docs/codex/CONTRACTS.md`
6. the A02 files listed above
