# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Shared development branch: integration
Current B04 integration merge: 536fac9
Current sprint: D1-D3 MVP implementation
Current day: B04 INTEGRATED LOCALLY; FULL-APPLICATION DEMO GATE VERIFIED LOCALLY
```

## Current Gate

The full-application gate is implemented and verified on branch
`feat/FULL-APPLICATION-demo-seed-and-flow-test` against disposable local
PostgreSQL. It adds the guarded idempotent seed, tracked role credentials,
school/college journey gates, bulk-import CSVs, and browser evidence. Shared demo
application was not attempted; B05 must consume this change only after it is
reviewed and merged through `integration`.

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
```

## Full-Application Demo Gate

```text
Full Application Demo Seed, Role Credentials & End-to-End Flow Test
Prompt: docs/codex/generated/FULL-APPLICATION-demo-seed-and-flow-test.md
Status: IMPLEMENTED AND VERIFIED LOCALLY; NOT YET MERGED
Local target: APPLIED
Shared demo target: NOT APPLIED / NOT VERIFIED
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

No implementation blocker remains for the local full-application gate. The
configured shared demo remains at its earlier B04 state and was not mutated or
re-verified by this branch. Do not infer that the local historical exams,
credentials, or outcomes exist there.

## Migration Lock

```text
Owner: NONE
Purpose: available; B04 introduces no schema change
Last integrated migration: 20260914143000_result_runs_publication
```

## Shared Contract Lock

```text
Owner: NONE
Purpose: B04 contracts are integrated locally; available for B04A/B05
```

## Developer A

```text
Last delivered task: A05 Duties, Attendance & Incidents
Status: MERGED; LOCKS RELEASED
```

## Developer B

```text
Last delivered task: B04 Student Portal, Admit Card & Grade Card
Merge: 536fac9 on local integration
Next queued task: Full Application Demo Seed, Role Credentials & Flow Test
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
- Bulk CSVs were parsed through the spreadsheet artifact runtime, inspected, and
  rendered with the exact five-column importer contract.
- No schema, migration, shared contract, or environment variable was introduced.
- Existing commands do not emit the persistent audit history B05 may need.
  B05 must treat audit persistence as an explicit dependency rather than infer
  audit events from seeded terminal states.

## Next Required Action

Review and merge `feat/FULL-APPLICATION-demo-seed-and-flow-test` through
`integration`. Then apply the guarded seed to the explicitly authorized target,
rerun the four demo gates there, and start B05 from the updated integration
baseline. A shared-demo application and remote push remain separate actions.
