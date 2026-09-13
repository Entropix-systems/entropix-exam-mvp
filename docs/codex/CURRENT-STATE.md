# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Known-good D0 verification: PASS at integration SHA 6182f80
Shared development branch: integration
Current sprint: D1–D3 MVP implementation
Current day: IAM QA FOLLOW-UP INTEGRATED; B02 FEATURE BRANCH DELIVERED, MERGE PENDING
```

## Current Gate

```text
Integration at `4e6b052` includes A04 Timetable, A05 Conduct, and the IAM
institution/active-role context follow-up. The IAM migration is applied to local
and shared demo databases, and live credentials-only login/context verification
passed before integration.

B02 Marks Entry & Independent Review is implemented with focused local database,
API, contract, Web, and shared-demo database verification on
`feat/B02-marks-entry-review`. It consumes the merged A03 roster, A05
attendance/result-hold contracts, and IAM active-role context; integration
review and merge remain pending.
```

## Completed

```text
D0 engineering foundation
repository structure
tenant/RLS foundation
database role separation
worker foundation
private storage/scanner foundation
email abstraction
fixtures
CI
fresh-clone verification
d0-ready tag
IAM Phase 3 PostgreSQL persistence, production API wiring and admin endpoints
IAM browser login, membership directory, invitation, session, recovery,
deactivation and tenant-isolation demo gate
IAM QA-01 through QA-06 implementation, verification, and integration
A04 Timetable, Halls & Seats
A05 Duties, Attendance & Incidents
```

## In Progress

```text
B02 is implemented, focused-verified, deployed to the shared demo database, and
delivered on `feat/B02-marks-entry-review` from integration baseline `4e6b052`.
Integration review and merge are pending.
```

## Blockers

```text
No B02 implementation or shared-demo deployment blocker. Integration review and
merge are pending.
```

## Migration Lock

```text
Owner: Developer B — B02 Marks Entry & Independent Review
Purpose: Evaluation assignment, marks batch, component-mark persistence, and
Exam.inputRevision
Last integrated migration: `20260914100000_iam_context_switching`
```

## Shared Contract Lock

```text
Owner: Developer B — B02 Marks Entry & Independent Review
Purpose: Evaluation assignment, roster, save, submit, return, approve, reopen,
and exam input-revision contracts
```

## Developer A

```text
Task: A05 Duties, Attendance & Incidents
Branch: feat/A05-duties-attendance-incidents
Status: MERGED INTO INTEGRATION AT `82a28cc`; LOCKS RELEASED
```

## Developer B

```text
Task: B02 Marks Entry & Independent Review
Branch: `feat/B02-marks-entry-review`
Status: FEATURE BRANCH DELIVERED FROM INTEGRATION `4e6b052`; MERGE PENDING
```

## Latest Integrated Acceptance

```text
Known-good D0 verification: PASS at integration SHA 6182f80.
Focused IAM browser/API/database demo journey: PASS.
A01 migration `20260913150000_academic_masters`: APPLIED to configured demo DB.
A01 Northstar/Cedar seed and academic tenant-isolation smoke: PASS.
A01 API/Web unit tests, relevant builds/typechecks/lints: PASS.
A02 migration `20260913170000_people_imports`: APPLIED to configured demo DB.
A02 fixtures: Northstar 100 students/4 faculty/300 enrolments; Cedar 20/3/60.
A02 valid/invalid/atomic/retry/self-scope tests and database isolation smoke: PASS.
A03 migrations `20260913193000_exams_registration` and constraint-name alignment
`20260913194000_exams_registration_constraint_names`: APPLIED to configured demo DB.
A03 fixtures: Northstar 1 submitted application/3 subjects; Cedar 20 approved
registrations/60 stable roster rows. Focused tests and relevant builds: PASS.
A04 migrations `20260914010000_timetable_halls_seats` and
`20260914011000_timetable_constraint_names`: APPLIED; focused rules, RLS smoke,
typechecks, build, and lint: PASS.
A05 migrations through `20260914022000_attendance_sitting_integrity`: APPLIED;
focused rules, RLS smoke, API/Web/DB/contracts verification: PASS.
IAM QA migration `20260914100000_iam_context_switching`: APPLIED to disposable
local PostgreSQL and shared demo database. IAM PostgreSQL 9 tests, API 82 tests,
API E2E 2, Web 26, Domain 32, Worker 2, and canonical `pnpm d0:verify`: PASS.
Live admin login: HTTP 201; `/auth/me`: Northstar College / INSTITUTION_ADMIN;
logout: HTTP 201.
```

## Current B02 Acceptance Evidence (Unmerged)

```text
B02 migration `20260914040000_evaluation_marks_review`: APPLIED to disposable
local PostgreSQL and the configured shared demo database; Prisma reports all 14
migrations up to date in both environments.
B02 Cedar fixture: 3 department-matched evaluation assignments in local and
shared demo databases; evaluation assignment/tenant-isolation smoke PASS through
the restricted application role in both environments.
Real repository/database flow: range/stale/unassigned rejection, assigned save,
submit, return, resubmit, self-approval denial, independent approval, ABSENT
blank enforcement, WITHHELD visibility, history, reopen, and input-revision
invalidation PASS.
Focused evaluation service tests: 8 PASS.
Relevant contracts/domain/API/Web/DB builds and typechecks plus API/Web lint:
PASS against the refreshed `4e6b052` baseline.
Targeted local browser flow: PASS for multi-institution login, Cedar controller
scope, assignment-only examiner scope, save/reload persistence, submit, return,
resubmit, independent approve, approved reload, ABSENT/WITHHELD display, and the
controller-only reopen action; no console errors or framework overlay detected.
```

## Next Required Action

```text
Review and merge B02 through integration, then release both locks. B03 consumes
approved-batch and exam input-revision contracts only after that merge.
```
