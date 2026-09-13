# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Known-good D0 verification: PASS at integration SHA 6182f80
Shared development branch: integration
Current sprint: D1–D3 MVP implementation
Current day: D1 PEOPLE / IMPORT VERTICAL SLICE COMPLETE
```

## Current Gate

```text
A01 Academic Masters and A02 Students/Faculty/Enrolments are implemented on
`codex/start-enrolments-import-work`. A02 migration, fixtures, RLS smoke, focused API tests,
and Web/API/DB builds pass. Authenticated browser proof still requires an
existing demo credential.
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
M01 Academics Department records and IAM department-source integration
A02 review/commit/merge from d1-a-academic-masters
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
Purpose: A02 people/import migration applied; retain until branch merge
```

## Shared Contract Lock

```text
Owner: Developer A
Purpose: D1 contract freeze
```

## Developer A

```text
Task: A02 Students, Faculty, Enrolments & Import
Branch: codex/start-enrolments-import-work
Status: IMPLEMENTED AND FOCUSED VERIFIED; AWAITING REVIEW/COMMIT/MERGE
```

## Developer B

```text
Task: IAM Phase 3 Backend/DB
Branch: `d1-b-iam-phase3`
Status: MERGED INTO INTEGRATION
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
```

## Next Required Action

```text
Review and commit the A01+A02 branch, merge it through integration, then release
or transfer the migration and contract locks. Dependent registration/scheduling
lanes must pull/rebase before consuming Student, Enrolment, Cohort, or Subject IDs.
```
