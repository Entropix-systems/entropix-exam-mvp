# SESSION HANDOFF — DEV A

Last updated: 2026-09-13
Branch: `integration`
Source commit: `37b945f` (`feat/A03-exam-registration`)
Integration base before merge: `1165f35`

## Current Sprint Goal

Working Examination ERP demo for Tuesday. A03 now supplies persisted exams,
registration decisions and stable approved subject-roster IDs to A04/B02.

## Current Task

Task: A03 — Exams & Registration
Status: MERGED INTO INTEGRATION; AUTHENTICATED BROWSER PROOF REMAINS OPTIONAL WHEN CREDENTIALS ARE AVAILABLE

## Implemented

- Tenant-owned Exam, ExamSubject, immutable RuleVersion, Registration and
  RegistrationSubject persistence with composite tenant-safe relationships,
  checks, forced RLS, uniqueness and optimistic version fields.
- Exam creation validates B01 `ResultRuleInput`, persists canonical
  `ValidatedResultRule`, and freezes it once when registration opens.
- Command-only registration workflow: draft, submit/resubmit, approve, reject,
  cancel, controller eligibility, registration window open/close and auto-enrol.
- Submission/approval rechecks active student, term/cohort, active enrolled
  subjects and controller eligibility, retaining exact evidence in
  `EligibilitySnapshot`.
- Student actions resolve the Student from authenticated membership. Controller
  actions require INSTITUTION_ADMIN or EXAM_CONTROLLER.
- `/exams` uses real API state for controller setup/review and student
  application; Cedar auto-enrol is a persisted controller action.

## Stable Contracts / IDs

- `packages/contracts/src/results.ts`: shared `ResultRuleInput` and
  `ValidatedResultRule`; B01 re-exports and consumes these types.
- `packages/contracts/src/exam.ts`: `ExamCreateInput`, `ExamRecord`,
  `ExamSubjectRecord`, `RuleVersionRecord`, `ExamsSnapshot`.
- `packages/contracts/src/registration.ts`: `EligibilitySnapshot`,
  `RegistrationRecord`, `RegistrationSubjectRecord` and command inputs.
- Downstream A04/B02 must use `RegistrationSubject.id` as the stable approved
  roster identity and must not duplicate registration subjects.

## Migration / Locks

- Migration sequence: `20260913193000_exams_registration` plus canonical
  foreign-key-name alignment `20260913194000_exams_registration_constraint_names`.
- Both migrations are applied to the configured Supabase demo database.
- Migration and shared-contract locks are released in `CURRENT-STATE.md`.

## Demo Data

- Northstar College: one real `SUBMITTED` NS26007 application, 3 subjects.
- Cedar School: 20 real `APPROVED` auto-enrol registrations, 60 stable
  RegistrationSubject roster rows.
- `pnpm seed:exams` is retry-safe for existing registrations (second run created 0).

## Verification

- A03 service test: PASS, 6 tests (eligible submit, inactive rejection, closed
  window, foreign ownership, controller reason, auto-enrol).
- Full API suite: PASS, 76 tests (required elevated local listener/database access).
- Web suite: PASS, 20 tests. Domain/B01 suite: PASS, 31 tests.
- Contracts, Domain, DB, API and Web focused builds/typechecks: PASS.
- Prisma format/validate/generate: PASS.
- Both A03 migrations: APPLIED.
- Live Prisma schema diff: PASS, no difference detected.
- `pnpm --filter @entropix/db smoke:exams`: PASS; missing tenant exposed zero
  rows, Northstar could not see Cedar exam, Cedar roster IDs were 60 unique UUIDs.
- API and Web lint: PASS. React best-practices review: PASS after replacing an
  effect-triggered synchronous load with parallel async initialization.
- Authenticated browser flow: NOT RUN; no repository-managed demo credential.
- Broad `pnpm d0:verify`: NOT RUN per sprint/task instructions.

## Limitations / Blockers

- Authenticated controller/student UI proof needs an existing fictional login.
- Department-scoped controller refinement is deferred; A03 controller commands
  currently use tenant-wide INSTITUTION_ADMIN/EXAM_CONTROLLER grants.
- No timetable, marks, publication, fees or attendance behavior is implemented here.
- No implementation blocker remains.

## Relevant Files

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260913193000_exams_registration/migration.sql`
- `packages/contracts/src/{exam,registration,results}.ts`
- `apps/api/src/modules/exams/`
- `apps/web/src/pages/exams-page.tsx`
- `packages/db/scripts/{seed-exams,exams-rls-smoke}.ts`

## Next Exact Action

1. A04/B02 pull integration and consume approved `RegistrationSubject.id` rows.
2. If credentials are available, verify Northstar student save/submit and
   controller reject/resubmit/approve plus Cedar auto-enrol at `/exams`.
