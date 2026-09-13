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
A04 Timetable, Halls & Seats is implemented on `feat/A04-Timetable-Halls&Seats`
from integration base `48dac03`. Both A04 migrations are applied with no live
schema drift; Cedar has 3 published papers, 2 halls and 60 deterministic seats.
Focused rules tests, RLS smoke, DB/API typechecks, Web build and API/Web lint pass.
Authenticated browser proof still requires a demo credential.
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
A04 is ready for review/integration. B02 marks remains independent; B04/duties
must wait for A04 migration and typed scheduling contracts to merge.
```

## Blockers

```text
Department records now exist in A01; IAM still needs a focused follow-up to consume
them for department-scoped grant selection. IAM must not own or fabricate them.
No repository-managed demo password exists for authenticated browser verification.
```

## Migration Lock

```text
Owner: Developer A — A04 Timetable, Halls & Seats
Purpose: Held through A04 review/merge for ExamPaper, Hall, HallSitting and SeatAssignment persistence
```

## Shared Contract Lock

```text
Owner: Developer A — A04 Timetable, Halls & Seats
Purpose: Held through A04 review/merge for scheduling snapshot, allocation and publication contracts
```

## Developer A

```text
Task: A04 Timetable, Halls & Seats
Branch: feat/A04-Timetable-Halls&Seats
Status: IMPLEMENTED AND VERIFIED; READY FOR REVIEW/MERGE; LOCKS HELD UNTIL MERGE
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
```

## Next Required Action

```text
Review and merge A04 into integration, then release both locks and have B04/duty
lanes pull/rebase before consuming scheduling IDs. Run authenticated controller
browser proof later if a fictional demo credential is supplied.
```
