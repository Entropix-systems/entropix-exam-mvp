# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Shared development branch: integration
Current B04 integration merge: 536fac9
Current sprint: D1-D3 MVP implementation
Current day: B04 INTEGRATED LOCALLY; FULL-APPLICATION DEMO GATE QUEUED BEFORE B05
```

## Current Gate

Local `integration` includes B04 Student Portal, Admit Card & Grade Card at merge
commit `536fac9`, on top of the previously integrated IAM and A01-B03 vertical
slices. B04 is focused-verified. The next prerequisite before B05 is the guarded,
idempotent full-application seed, role credential matrix, and journey gate in
`docs/codex/generated/FULL-APPLICATION-demo-seed-and-flow-test.md`.

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

## In Progress

```text
Full Application Demo Seed, Role Credentials & End-to-End Flow Test
Prompt: docs/codex/generated/FULL-APPLICATION-demo-seed-and-flow-test.md
Status: QUEUED; REQUIRED BEFORE B05
```

## Blockers

The configured shared demo has a complete published Cedar timetable and the
real authenticated B04 registration/timetable/admit-card journey now passes.
ANNUAL-2026 has no current result because its three sittings are scheduled for
15-17 September 2026; conduct correctly reports 63 incomplete items and three
marks batches remain unapproved. Do not fabricate a publication before those
business inputs are complete.

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

## Next Required Action

Implement and verify
`docs/codex/generated/FULL-APPLICATION-demo-seed-and-flow-test.md` on a
short-lived branch, including the tracked
`docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md` artifact. Merge it through `integration`,
then start B05 against the resulting authoritative whole-application data. Push
of local integration remains a separate explicit action.
