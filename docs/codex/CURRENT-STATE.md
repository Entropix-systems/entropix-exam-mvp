# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Shared development branch: integration
Current B05 integration merge: 5d021ed
Current release-evidence implementation: 88141c6
Current sprint: MVP release verification
Current day: CANONICAL A01-A15 PASS; LOCAL RELEASE GATE GO
```

## Current Gate

The release-evidence implementation is committed at `88141c6`. All canonical
A01-A15 assertions pass against disposable local PostgreSQL and private object
storage. A fresh clean checkout of that commit passed frozen installation with
the repository-pinned Node 24.20.0 and pnpm 12.3.4, all 17 local migrations,
the complete configured automated suite, `smoke:release`, seeded workflows, and
the release browser matrix. See `FINAL-RELEASE-VERIFICATION.md`.

## Completed

```text
D0 engineering foundation and d0-ready baseline
IAM persistence, browser flow, and active institution/role context
A01 Academic Masters
A02 People, Students & Import
A03 Exams & Registration
A04 Timetable, Halls & Seats
A05 Duties, Attendance & Incidents
B01 Pure Result Rules
B02 Marks Entry & Independent Review (merged by PR #8 at 9720aea)
B03 Result Runs & Publication (merged by PR #9 at eea1b18)
B04 Student Portal, Admit Card & Grade Card (merged locally at 536fac9)
Full Application Demo Seed, Role Credentials & End-to-End Flow Test (merged at b5fe792)
B05 Dashboard, Reports, Audit & Demo Polish (merged at 5d021ed)
```

## Full-Application Demo Gate

```text
Full Application Demo Seed, Role Credentials & End-to-End Flow Test
Prompt: docs/codex/generated/FULL-APPLICATION-demo-seed-and-flow-test.md
Status: INTEGRATED AT b5fe792; VERIFIED ON DISPOSABLE LOCAL POSTGRESQL
Local target: APPLIED
Shared demo seeded journey data: NOT APPLIED / NOT VERIFIED
```

Local authoritative historical outcomes:

```text
CEDAR-HIST-2026: 20 students; PASS 18, FAIL 0, ABSENT 1, WITHHELD 1
NORTHSTAR-HIST-2026: 2 students; PASS 1, FAIL 1, ABSENT 0, WITHHELD 0
Completed subjects: Cedar 3/3, Northstar 3/3
Current historical publications: exactly 1 per exam; stable across seed reruns
Future fixture: Cedar ANNUAL-2026 remains schedule revision 1 on 15-17 Sep 2026
Credentials: 13 usable role/student identities plus 1 expected suspended denial
Bulk import pack: 12 Northstar rows, 12 Cedar rows, 7 negative/reconciliation rows
```

## Blockers

No local release blocker remains. The configured Supabase target was not changed
during release-evidence closure and has not been verified with
`20260914160000_worker_recovery`; shared-target deployment remains a separate,
explicitly authorized operation.

## Migration Lock

```text
Owner: NONE
Purpose: Release-evidence closure complete
Last integrated migration: 20260914160000_worker_recovery
Configured Supabase target: 20260914160000 NOT APPLIED / NOT VERIFIED
```

## Shared Contract Lock

```text
Owner: NONE
Purpose: B05 introduced no shared contract change
```

## Developer A

```text
Last delivered task: A05 Duties, Attendance & Incidents
Status: MERGED; LOCKS RELEASED
```

## Developer B

```text
Last delivered task: B05 Dashboard, Reports, Audit & Demo Polish
Implementation: 6cd45a4
Integration merge: 5d021ed
Status: MERGED; LOCKS RELEASED
```

## Current B03 Acceptance Evidence (Integrated)

- Migration applied to disposable local PostgreSQL; all 15 migrations report up
  to date and Prisma schema validation passes.
- Focused conduct/result service and guardrail tests: 14 passed, covering explicit
  ABSENT/WITHHELD privacy, blockers, controller scope, stale errors, retry-safe
  publication, withdrawal/student scope, forced RLS, immutable snapshots, and
  one-current-publication SQL.
- Real restricted-role persistence flow passes: incomplete marks block compute;
  a conduct incident advances `Exam.inputRevision` and makes the prior run stale;
  compute, retry-safe publish, exactly one current publication, own-current-only
  student read, withdrawal, correction, recompute, and versioned republish work.
- Contracts/domain/API/Web/DB verification, API/Web lint, and production builds
  pass. Route-level lazy loading keeps every Web production chunk below Vite's
  500 kB warning threshold.
- The shared demo database reports all 15 migrations current after applying
  `20260914143000_result_runs_publication`. A read-only authenticated `/results`
  gate loaded the split Results chunk and returned the empty shared-demo state
  without console errors or a Vite overlay.
- The Prisma PostgreSQL adapter is pinned to `pg` 8.18.0 at the workspace level;
  the focused transaction-backed result smoke passes without the upstream
  concurrent-query deprecation warning seen with `pg` 8.23.0.
- Targeted authenticated browser verification passes for the Cedar controller
  Results page: readiness/current publication, immutable candidate register,
  counts, ABSENT/WITHHELD presentation, withdrawal, idempotent compute, and
  versioned publish work with no overlay or browser error.
- README, local environment examples, and root/package scripts now provide a
  reproducible install, infrastructure, migrate, seed, development, focused
  verification, and teardown path; the documented `pnpm setup:local` sequence
  passes against disposable local PostgreSQL.

## Current B04 Acceptance Evidence (Integrated Locally)

- `pnpm verify:b04` passes: 13 focused API result/portal tests, 4 focused Web
  navigation/client tests, contracts build, API/Web typechecks, and API/Web lint.
- API and Web production builds pass; all B04 `/api/v1/me/*` routes map at
  startup, health returns 200, and an unauthenticated portal read returns 401.
- The read-only restricted-role `pnpm smoke:student-portal` query resolves the
  configured Northstar student from membership context and returns only the
  approved registration. Current shared data has no published timetable or
  current publication for that student, so it correctly returns neither current
  document nor result.
- `PORTAL_SMOKE_TENANT_SLUG=cedar-school pnpm smoke:student-portal` passes for
  two scoped Cedar students; Student 03 has one approved registration, one
  published timetable with three papers, and no current result.
- Cedar Student 03 was provisioned through the real one-time password-reset
  workflow. A real browser login and refresh-cookie reload resolve only that
  student's Class 10 registration, timetable, Hall A seat 03, and current admit
  card. Sign-out returns to the login page and revokes the verification session.
- The real Cedar admit card prints as one page with the student/roll identity,
  all three local-time sittings, seat 03, stable issue ID, and schedule revision
  1. The browser reported no page errors or Vite overlay.
- A browser rendering check with local fixture responses covers reload, the
  mockup-aligned student portal, local-time hall/seat display, and both printable
  documents without a Vite overlay or page error. Admit and grade print outputs
  are each one page and include their current revision/version and issue ID.
- No schema, migration, stored file, public URL, or signed URL was added; current
  printable HTML references derive from the approved registration plus schedule
  revision or the active publication plus publication version.

## Full-Application Verification Evidence

- `pnpm seed:demo:full-application` passed repeatedly with stable publication
  identities and outcome summaries.
- `pnpm smoke:demo:full-application`, `pnpm test:demo:roles`, and
  `pnpm test:demo:journey` pass against restricted local runtime access.
- `pnpm verify:b04`, API/DB typechecks, and API/Web builds pass; both health
  endpoints return 200 in the seeded environment.
- Local S3 mock/ClamAV private-storage lifecycle and signed download smoke pass;
  notification ACCEPT/FAIL and business-state isolation smoke also pass.
- A real Cedar Student 03 browser journey produces a one-page grade card. Eight
  curated screenshots cover controller, faculty, invigilator, PASS document, and
  WITHHELD privacy states without browser errors.
- Bulk CSVs were parsed through the spreadsheet artifact runtime and now pass a
  real tenant-scoped preview, commit, persisted-graph, idempotent-replay, and
  invalid-reconciliation rejection check via `pnpm test:demo:bulk-imports`.
- No schema, migration, shared contract, or required environment variable was
  introduced. Optional `DEMO_LOCAL_DATABASE_NAME` and
  `DEMO_LOCAL_DATABASE_PORT` narrow which local database the guarded demo
  commands may mutate without a shared-target acknowledgement.
- Historical seed commands predate B05 audit persistence and therefore do not
  produce fabricated audit history. New successful mapped business commands are
  recorded after migration deployment.

## Current B05 Acceptance Evidence

- The role-scoped Overview reads authoritative registration, scheduling,
  conduct, evaluation, result-run, and publication state with explicit readiness
  blockers; the Reports page exposes only exports allowed for the active role.
- Registration, timetable/seating, attendance/incidents, evaluation progress,
  and current-result CSVs are generated server-side. Fields are quoted and
  spreadsheet formula prefixes are neutralized; WITHHELD rows omit percentage
  and GPA.
- `20260914150000_audit_events` applied through Prisma to disposable local
  PostgreSQL and the configured Supabase target. Prisma reports 16/16 migrations
  current. Forced RLS and tenant/membership foreign keys preserve tenant
  boundaries; update/delete triggers make recorded events immutable.
- Successful mapped business commands now record actor, active role, action,
  target, reason when supplied, request ID, and timestamp. Audit persistence is
  idempotent by tenant/request ID and does not invent pre-migration events.
- Focused API/Web tests, DB/API/Web typechecks, API/Web lint, API/Web production
  builds, and the full-application smoke pass locally.
- Authenticated browser journeys passed for Northstar College and Cedar School.
  Northstar historical showed 2 registrations, 3/3 scheduled papers, 6/6 seats,
  3/3 approved subjects, and a current publication; Cedar historical showed 20,
  3/3, 60/60, 3/3, one WITHHELD hold, and a current publication. A Northstar
  hall command produced a real tenant-scoped audit row.

## Post-Browser-Audit Remediation

- The audit now classifies BUG-002 as a product-rule clarification and no defect.
  ABSENT subject percentage/grade remain nonnumeric, credited absence remains in
  the GPA denominator with zero points, released ABSENT remains grade-card
  eligible, and WITHHELD continues to suppress numeric results and grade cards.
- The Web app has one role-aware landing/route policy, an explicit platform-only
  workspace, safe login and context-switch destinations, compact operational
  badges, edit-cleared login errors, and an attention card derived from the same
  ordered readiness steps shown on the overview.
- The full Web suite passes with 17 files and 53 tests. API, domain, worker,
  contract, migration, seeded role/journey/import, and representative browser
  checks also pass as recorded in `POST-REMEDIATION-VERIFICATION.md`.
- No schema, migration, contract, permission, readiness-rule, or result-semantic
  change was introduced by this remediation.

## Final Release-Evidence Closure

- The four seed-coupled legacy RLS smokes now scope fixture assertions to their
  owning exam/hall data while retaining missing-context, foreign-tenant, and
  composite-foreign-key denial checks.
- A06 induces real concurrent student, seat, hall, and invigilator races and
  proves one winner without duplicate allocation.
- A12 exercises pending/infected/quarantined, time-window, assignment, role,
  tenant, and expired-signed-URL denial through the private-document
  authorization surface.
- A13 kills a claimed worker, recovers its expired lease, denies the stale owner,
  and proves idempotent retry produces one business-key output.
- A15 restores a real database dump into a new database, restores a deleted
  referenced private object, compares tenant-table counts, publication identity,
  version and checksums, and rechecks missing-context RLS.
- A clean checkout at `88141c6` passed the repository-pinned runtime, frozen
  install, migration status/deploy, the full configured automated gate,
  `smoke:release`, seeded workflow suites, and fresh browser verification.
- BUG-002 remains the approved `SPEC-CLARIFICATION-001 / NO DEFECT` behavior;
  no result rule, result repository, payload, publication, or grade-card
  eligibility semantics changed.

## Next Required Action

Review and merge the two release-evidence commits. Apply and verify
`20260914160000_worker_recovery` on a shared target only through the normal
deployment approval path; do not infer shared-target readiness from the local
release result.
