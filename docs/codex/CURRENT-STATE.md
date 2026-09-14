# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Shared development branch: integration
Current integration SHA: 9720aea
Current sprint: D1-D3 MVP implementation
Current day: B02 INTEGRATED; B03 FEATURE BRANCH READY FOR REVIEW/MERGE
```

## Current Gate

`integration` at `9720aea` includes B02 Marks Entry & Independent Review plus
the previously integrated academics, people, exams, scheduling, conduct, and IAM
vertical slices. B03 Result Runs & Publication is implemented on
`feat/B03-result-runs-publication` from that exact baseline. Focused local
database, API, contract, and Web verification passes, and migration
`20260914143000_result_runs_publication` is applied to the shared demo database.
Review and merge remain pending.

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
```

## In Progress

```text
B03 Result Runs & Publication
Branch: feat/B03-result-runs-publication
Base: 9720aea
Status: SHARED-DEMO DEPLOYED AND FOCUSED-VERIFIED; REVIEW/MERGE PENDING
```

## Blockers

No B03 implementation or shared-demo deployment blocker. Review and integration
merge remain.

## Migration Lock

```text
Owner: Developer B - B03 Result Runs & Publication
Purpose: ResultRun, ResultItem, StudentResult, Publication, forced RLS, immutable
snapshot triggers, and one-current-publication enforcement
New migration: 20260914143000_result_runs_publication
Last integrated B02 migration: 20260914040000_evaluation_marks_review
```

## Shared Contract Lock

```text
Owner: Developer B - B03 Result Runs & Publication
Purpose: result readiness, immutable run/item/student snapshots, publication,
withdrawal, and current-only student result contracts
```

## Developer A

```text
Last delivered task: A05 Duties, Attendance & Incidents
Status: MERGED; LOCKS RELEASED
```

## Developer B

```text
Task: B03 Result Runs & Publication
Branch: feat/B03-result-runs-publication
Status: SHARED-DEMO DEPLOYED AND FOCUSED-VERIFIED; REVIEW/MERGE PENDING
```

## Current B03 Acceptance Evidence (Unmerged)

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

## Next Required Action

Review the B03 handwritten/generated/migration diff, merge through
`integration`, then release both locks and refresh dependent lanes.
