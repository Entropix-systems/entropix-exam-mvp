# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Known-good D0 verification: PASS at integration SHA 6182f80
Shared development branch: integration
Current sprint: D1–D3 MVP implementation
Current day: D1 EXAMS / REGISTRATION VERTICAL SLICE IMPLEMENTED
```

## Current Gate

```text
A03 Exams and Registration is implemented on `feat/A03-exam-registration` after
rebasing onto B01 at integration `e5f2250`. Its migration is applied; Northstar
application and Cedar auto-enrol fixtures, focused API tests, RLS smoke, and
Web/API/DB builds pass. Authenticated browser proof still requires a demo credential.
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
A03 review/commit/merge
A04 scheduling consumes approved RegistrationSubject UUIDs after A03 merge
```

## Blockers

```text
Department records now exist in A01; IAM still needs a focused follow-up to consume
them for department-scoped grant selection. IAM must not own or fabricate them.
No repository-managed demo password exists for authenticated browser verification.
```

## Migration Lock

```text
Owner: Developer A
Purpose: A03 exams/registration migration applied; retain until branch merge
```

## Shared Contract Lock

```text
Owner: Developer A
Purpose: A03 eligibility and persisted validated RuleVersion contracts; retain until branch merge
```

## Developer A

```text
Task: A03 Exams & Registration
Branch: feat/A03-exam-registration
Status: IMPLEMENTED AND FOCUSED VERIFIED; AWAITING AUTHENTICATED BROWSER PROOF/REVIEW/COMMIT/MERGE
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
```

## Next Required Action

```text
Run authenticated controller/student browser proof if credentials are supplied,
then review and commit A03 and merge through integration. Release/transfer both
locks; A04/B02 must pull integration before consuming RegistrationSubject IDs.
```
