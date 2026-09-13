# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Known-good D0 verification: PASS at integration SHA 6182f80
Shared development branch: integration
Current sprint: D1–D3 MVP implementation
Current day: D1 EXAMS / REGISTRATION VERTICAL SLICE MERGED
```

## Current Gate

```text
A05 Duties, Attendance & Incidents is implemented on
`feat/A05-duties-attendance-incidents`, stacked on A04 commit `3d697d9` from
integration base `48dac03`. A05 migrations are applied with no live schema drift.
Cedar has 3 invigilators and 3 pending duties. Focused conduct tests, RLS smoke,
DB/API/Web typechecks, API/Web builds and lint pass. Authenticated browser proof
still requires a demo credential.
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
```

## In Progress

```text
A04 remains first in the stacked merge order. A05 is implemented and awaits
review after A04 integration. B02/B03 must consume the authoritative A05
`ConductResultState` attendance/hold contract after A05 merges.
```

## Blockers

```text
Department records now exist in A01; IAM still needs a focused follow-up to consume
them for department-scoped grant selection. IAM must not own or fabricate them.
No repository-managed demo password exists for authenticated browser verification.
```

## Migration Lock

```text
Owner: Developer A — A05 Duties, Attendance & Incidents
Purpose: Held through stacked A04/A05 review and merge for conduct persistence
```

## Shared Contract Lock

```text
Owner: Developer A — A05 Duties, Attendance & Incidents
Purpose: Held through stacked A04/A05 review and merge for ConductResultState and conduct commands
```

## Developer A

```text
Task: A05 Duties, Attendance & Incidents
Branch: feat/A05-duties-attendance-incidents
Status: IMPLEMENTED; FOCUSED VERIFICATION PASS; STACKED REVIEW REQUIRED; LOCKS HELD UNTIL MERGE
```

## Developer B

```text
Task: B01 Result Rules / Pure Engine
Branch: `codex/implement-pure-result-rules-engine`
Status: MERGED INTO INTEGRATION AT `e5f2250`
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
`20260913194000_exams_registration_constraint_names`: both APPLIED to the configured demo database.
A03 fixtures: Northstar 1 submitted application/3 subjects; Cedar 20 approved registrations/60 stable roster rows.
A03 eligibility/transition tests, Prisma validation, RLS smoke, and Web/API/DB builds: PASS.
A04 migrations `20260914010000_timetable_halls_seats` and
`20260914011000_timetable_constraint_names`: APPLIED; live Prisma schema diff PASS.
A04 Cedar fixture: 3 published papers, 2 halls, 60 deterministic seat assignments;
retry-safe seed and tenant-isolation smoke PASS.
A04 focused schedule/allocation rules: 7 tests PASS; DB/API typechecks, Web build,
API/Web lint and controller-only timetable navigation test PASS.
A05 migrations `20260914020000_conduct_duties_attendance_incidents`,
`20260914021000_conduct_constraint_names` and
`20260914022000_attendance_sitting_integrity`: APPLIED; live Prisma schema diff PASS.
A05 Cedar fixture: 3 invigilators and 3 pending duties; retry-safe seed and
conduct tenant-isolation smoke PASS. Focused conduct rules: 7 tests PASS; API,
Web, DB and contracts typechecks/builds plus API/Web lint PASS.
```

## Next Required Action

```text
Review and merge A04 first. Review/rebase and merge A05 second, then release both
locks. B02/B03 pull/rebase and consume `ConductResultState`; do not duplicate
attendance or holds. Run authenticated controller/invigilator `/attendance`
browser proof later if fictional demo credentials are supplied.
```
