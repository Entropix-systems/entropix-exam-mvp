# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Known-good D0 verification: PASS at integration SHA 6182f80
Shared development branch: integration
Current sprint: D1–D3 MVP implementation
Current day: IAM QA-01 THROUGH QA-06 FOLLOW-UP VERIFIED LOCALLY
```

## Current Gate

```text
IAM institution/role context switching, credentials-only login, staff-only
cursor pagination and the no-UUID UI audit are complete on `fix/qa-iam-context`.
The new transactional migration and all repository gates pass against disposable
local PostgreSQL. It is also applied to the shared demo database after explicit
deployment approval; live login and `/auth/me` context verification pass.
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
IAM QA-01 through QA-06 implementation and local verification
```

## In Progress

```text
A04 scheduling and B02 marks may consume approved RegistrationSubject UUIDs
after pulling the latest integration branch.
```

## Blockers

```text
None for the IAM QA context flow.
```

## Migration Lock

```text
Owner: FREE after IAM QA context follow-up
Last change: `20260914100000_iam_context_switching` persists active role and
adds restricted identity-routing RLS policies
```

## Shared Contract Lock

```text
Owner: FREE after IAM QA context follow-up
Last change: authenticated institution/role context and paginated staff-directory contracts
```

## Developer A

```text
Task: A03 Exams & Registration
Branch: feat/A03-exam-registration
Status: MERGED INTO INTEGRATION; AUTHENTICATED BROWSER PROOF REMAINS OPTIONAL WHEN CREDENTIALS ARE AVAILABLE
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
IAM QA migration: APPLIED to disposable local PostgreSQL and the shared demo database.
IAM PostgreSQL 9 tests, API 82 tests, API E2E 2, Web 26, Domain 32, Worker 2: PASS.
Canonical `pnpm d0:verify`: PASS under available Node 24.19.0 (pin is 24.20.0).
Live admin login: HTTP 201; `/auth/me`: Northstar College / INSTITUTION_ADMIN; logout: HTTP 201.
```

## Next Required Action

```text
Refresh the current browser session and continue QA against the verified shared context.
```
