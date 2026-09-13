# SESSION HANDOFF — DEV A

Last updated: 2026-09-14
Branch: `feat/A04-Timetable-Halls&Seats`
Integration base: `48dac03`
Working tree: uncommitted A04 implementation ready for review

## Current Sprint Goal

Working Examination ERP demo for Tuesday. A04 now provides the persisted
timetable, halls, deterministic seats and published schedule revision needed by
duties and student-output work.

## Current Task

Task: A04 — Timetable, Halls & Seats
Status: IMPLEMENTED AND VERIFIED; READY FOR REVIEW/MERGE

## Implemented

- Tenant-owned `ExamPaper`, `Hall`, `HallSitting` and `SeatAssignment` models
  with composite tenant-safe relationships, checks, uniqueness, forced RLS and
  restricted runtime grants.
- One written paper per `ExamSubject`; paper time is a half-open
  `[startsAt, endsAt)` interval and snapshots expose the tenant timezone.
- Controller-only hall creation, exam-paper initialization, schedule editing,
  non-reserving allocation preview, atomic allocation commit and publication.
- Commit uses a tenant-scoped PostgreSQL advisory transaction lock, rechecks
  paper/hall/student conflicts and capacity, and rejects stale versions.
- Deterministic allocation consumes approved `RegistrationSubject.id` rows in
  roll-number order across explicitly selected room order; seat numbering
  restarts at 1 per hall.
- Publication requires every paper scheduled and every approved roster row
  allocated exactly once. Published edits return the exam to PREPARATION;
  republishing increments `Exam.scheduleRevision`.
- `/schedule` follows the mockup timetable/hall/seating patterns and uses real
  API/database state, including readiness, preview totals and unallocated rows.

## Stable Contracts / IDs

- `packages/contracts/src/scheduling.ts` owns `SchedulingSnapshot`,
  `ExamScheduleRecord`, `ExamPaperRecord`, `HallRecord`, `HallSittingRecord`,
  `SeatAssignmentRecord`, allocation DTOs and publication input.
- `SeatAssignment.registrationSubjectId` is the A03 approved-roster identity.
- `ExamPaper.id`, `Hall.id`, `HallSitting.id`, `SeatAssignment.id` and
  `Exam.scheduleRevision` are the persisted values for B04/duty consumers.
- Routes are under `/api/v1/scheduling`; exact route list is in `CONTRACTS.md`.

## Migration / Locks

- Applied migrations: `20260914010000_timetable_halls_seats` and
  `20260914011000_timetable_constraint_names`.
- Live Prisma schema diff reports no difference.
- Migration and shared-contract locks remain owned by Developer A until this
  branch is reviewed and merged into integration.

## Demo Data

- Cedar School: 3 scheduled/published papers, 2 halls and 60 seat assignments
  for the 60 stable A03 registration-subject roster rows.
- Hall A has 30 seats and receives 20 ordered students per paper; Hall B has 4
  seats and is available for visible over-capacity rejection.
- `pnpm seed:scheduling` is retry-safe for an already matching allocation.

## Verification

- A04 focused API test: PASS, 7 tests covering successful deterministic room
  allocation, over-capacity, student overlap, hall overlap, back-to-back
  half-open boundary and publication readiness.
- Controller-only timetable navigation test: PASS.
- Contracts, DB and API typechecks: PASS. Web production build: PASS.
- Prisma format/validate/generate: PASS.
- Both A04 migrations: APPLIED. `prisma migrate status`: up to date.
- Live Prisma schema diff: PASS, no difference detected.
- `pnpm seed:scheduling` repeated: PASS.
- `pnpm --filter @entropix/db smoke:scheduling`: PASS; 3 papers, 2 halls,
  60 unique roster-linked seats, deterministic roll order and tenant isolation.
- API and Web lint: PASS. React best-practices review: PASS.
- Authenticated browser flow: NOT RUN; no repository-managed demo credential.
- Broad `pnpm d0:verify`: NOT RUN per sprint/task instructions.

## Limitations / Blockers

- Authenticated controller UI proof requires an existing fictional login.
- Hall editing/deletion, timetable optimization, accommodations and
  post-conduct rescheduling are intentionally outside A04.
- B04/duty lanes must not consume the new schema/contracts until A04 is merged.
- No implementation blocker remains.

## Relevant Files

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/2026091401*`
- `packages/contracts/src/{exam,scheduling}.ts`
- `apps/api/src/modules/scheduling/`
- `apps/web/src/{scheduling,pages/scheduling-page.tsx}`
- `packages/db/scripts/{seed-scheduling,scheduling-rls-smoke}.ts`
- `docs/codex/{CURRENT-STATE,CONTRACTS,DECISIONS}.md`

## Next Exact Action

1. Review and commit the A04 diff, then merge it into `integration`.
2. Release both locks in `CURRENT-STATE.md` after merge.
3. B04/duty lanes pull/rebase and consume the stable scheduling IDs/revision.
4. If credentials become available, run the authenticated `/schedule` flow.
