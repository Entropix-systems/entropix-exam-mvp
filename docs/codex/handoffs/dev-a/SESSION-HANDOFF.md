# SESSION HANDOFF — DEV A

Last updated: 2026-09-14
Branch: `feat/A05-duties-attendance-incidents`
Integration base: `48dac03`; stacked on A04 commit `3d697d9`
Working tree: uncommitted A05 implementation ready for focused review

## Current Sprint Goal

Working Examination ERP demo for Tuesday. A05 now supplies assignment-scoped
invigilator duties, versioned attendance, incidents and authoritative result holds
on top of A04 sittings/seats and A03 approved roster identities.

## Current Task

Task: A05 — Duties, Attendance & Incidents
Status: IMPLEMENTED; FOCUSED VERIFICATION PASS; STACKED REVIEW REQUIRED

## Implemented

- Tenant-owned `Duty`, `AttendanceBatch`, `Attendance`, `Incident` and
  `IncidentStudent` persistence with composite same-tenant relationships, forced
  RLS, runtime grants, optimistic versions and reason/timestamp audit fields.
- Controller duty assignment, invigilator accept/decline and explicit replacement
  chains. Active pending/accepted duties are overlap-checked under a tenant conduct
  advisory lock; only active faculty with an `INVIGILATOR` grant may be assigned.
- Invigilator snapshot scope is resolved from `AuthenticatedContext.membershipId`.
  Pending/declined/unassigned invigilators receive no roster. Accepted invigilators
  may save/submit only inside the paper's half-open conduct window.
- Attendance starts as `NOT_MARKED`, supports versioned draft saves, rejects final
  submission until every allocated seat is marked, and is locked after submission.
  Controllers may reopen only with a reason.
- Student/hall incident creation, relationally validated affected students,
  controller `CLEARED` / `RETAIN_WITHHELD` / `NO_RESULT_IMPACT` dispositions and
  derived result holds.
- Real `/attendance` Web route follows the mockup duty, roster, status, incident
  and action patterns and remains usable on narrow/mobile layouts.
- Retry-safe Cedar conduct seed adds one fictional controller identity without a
  password, `INVIGILATOR` grants for the three fixture faculty, and one pending duty
  for each published hall sitting.

## Exact Contract Developer B Must Consume

- Typed source: `packages/contracts/src/duties.ts`.
- Read route: `GET /api/v1/conduct/exams/:examId/result-state`.
- `ConductResultState.attendance` contains only submitted attendance rows keyed by
  `registrationSubjectId`, plus `studentId`, `examSubjectId`, canonical `state` and
  `attended`. `ABSENT` is preserved with `attended=false`; `LATE` is preserved with
  `attended=true`. Never create a numeric mark from `ABSENT`.
- `ConductResultState.holds` contains one entry per affected incident/student when
  disposition is `OPEN` or `RETAIN_WITHHELD`. `CLEARED` and `NO_RESULT_IMPACT` emit
  no hold. Result computation/publication must yield `WITHHELD` for held students.
- `ready=false` when any hall sitting lacks an accepted duty/submitted attendance,
  or a hall incident has neither affected students nor `NO_RESULT_IMPACT` closure.
- B02/B03 must consume this state and must not create duplicate attendance or hold
  records. `SeatAssignment.registrationSubjectId` remains the roster identity.

## Migration / Locks

- Applied migrations: `20260914020000_conduct_duties_attendance_incidents`,
  `20260914021000_conduct_constraint_names` and
  `20260914022000_attendance_sitting_integrity`.
- `prisma migrate status`: up to date; live Prisma schema diff: no difference.
- Migration and shared-contract locks remain owned by Developer A through stacked
  A04/A05 review and merge.

## Verification

- Focused Conduct API unit test: PASS, 7 tests covering membership assignment
  scope, unassigned denial, duty overlap error, NOT_MARKED closure block,
  ABSENT/LATE semantics, hold dispositions and published-result immutability.
- Workspace navigation test: PASS; controller and invigilator see Duties &
  attendance, students do not.
- Contracts, DB, API and Web typechecks: PASS. API and Web production builds: PASS.
- Prisma format/validate/generate: PASS.
- All three A05 migrations: APPLIED. Migration status: up to date. Live schema diff:
  PASS, no difference detected.
- `pnpm seed:conduct` repeated: PASS; second run created 0 duplicate duties.
- `pnpm --filter @entropix/db smoke:conduct`: PASS; 3 Cedar duties, 3 invigilator
  grants, missing-context denial and cross-tenant duty isolation.
- API and Web lint: PASS. React best-practices review: PASS.
- Authenticated controller/invigilator `/attendance` browser flow: NOT RUN; no
  repository-managed demo credential exists.
- Broad `pnpm d0:verify`: NOT RUN per sprint/task instructions.

## Limitations / Blockers

- A04 must merge before this stacked A05 branch can merge cleanly.
- Authenticated manual UI proof requires fictional controller and invigilator
  credentials. The seed intentionally creates no password or secret.
- Live mutation smoke of shared sitting rows was not run because safe cleanup would
  require deleting shared demo attendance/incidents; focused service tests plus
  non-destructive live schema/RLS/fixture checks were used instead.
- Advanced duty optimization, attachment workflows, investigations, notifications
  and reporting are intentionally outside A05.

## Relevant Files

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/2026091402*`
- `packages/contracts/src/duties.ts`
- `apps/api/src/modules/conduct/`
- `apps/web/src/{conduct,pages/conduct-page.tsx}`
- `packages/db/scripts/{seed-conduct,conduct-rls-smoke}.ts`
- `docs/codex/{CURRENT-STATE,CONTRACTS,DECISIONS}.md`

## Next Exact Action

1. Review/merge A04 into `integration` first.
2. Rebase/review A05, then merge it and release migration/contract locks.
3. Developer B pulls/rebases, rereads `CONTRACTS.md` and consumes
   `ConductResultState` for marks/results/publication.
4. If credentials become available, run the authenticated `/attendance` flow as
   both controller and assigned invigilator.
