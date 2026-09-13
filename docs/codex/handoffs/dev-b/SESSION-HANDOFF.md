# SESSION HANDOFF — DEV B

Last updated: 2026-09-13
Branch: integration
Base: 2b287e3
Head: 2b287e3

## Current Sprint Goal

Working Examination ERP demo for Tuesday.

IAM is complete in another developer's lane. Do not rebuild or re-analyze IAM unless a concrete integration blocker requires it.

## Lane Ownership

Developer B owns:

- result rules
- marks entry and independent review
- result runs and publication
- student outputs, dashboard, reports, and demo polish

Developer A owns:

- academic masters
- students, faculty, enrolments, and demo import
- exams and registration
- timetable, halls, seats, duties, attendance, and incidents

## Completed in This Lane

- No business slice is complete on `integration`.

## Current Task

Task: B01 — Result Rules / Pure Engine
Status: NOT STARTED

What already works:

- D0 workspace and deterministic result fixtures exist.
- Result outcome and attendance enums exist in `packages/contracts`.
- `fixtures/results/result-engine-fixtures.json` contains the key arithmetic cases.

What remains:

- Implement decimal-safe rule validation, subject results, aggregate outcomes, and GPA in `packages/domain`.
- Add focused tests for every supplied result fixture.

## Stable Context for Next Session

The next agent may assume:

- IAM is complete in a parallel lane and should be consumed, not changed.
- D0 foundation remains available.
- `packages/domain/src/results/index.ts` and `packages/domain/src/rules/index.ts` are empty.
- Current business API modules are empty Nest module shells.
- Current web app is the Vite starter; the interactive reference is `docs/design/index.html`.
- Threshold decisions use unrounded decimal values; display rounding is half-up to two decimals.
- ABSENT produces no numeric result; WITHHELD hides numeric results and GPA.

## Shared Contracts / Schema That Matter

- `RESULT_OUTCOMES`, `ATTENDANCE_STATES`, and marks component/state enums already exist.
- Developer B must consume Developer A's `Exam`, `ExamSubject`, approved `RegistrationSubject`, attendance, and incident-hold records rather than duplicate them.

## Migrations

Latest relevant migration:

- `20260911063050_identity_tenancy_rls`

Migration lock:

- DEV B, according to the current `CURRENT-STATE.md`; B01 itself needs no migration.

Required action:

- Coordinate transfer to DEV A for A01, or retain it only for an agreed single shared migration sequence.

## Shared Contract Lock

Owner:

- DEV A, according to the current `CURRENT-STATE.md`.

Relevant shared contract change:

- B01 should stay inside `packages/domain` unless a reviewed RuleVersion/result DTO contract is coordinated with DEV A.

## Files / Modules to Continue From

Read these first next session:

- `docs/codex/generated/B01-result-engine.md`
- `packages/domain/src/results/index.ts`
- `packages/domain/src/rules/index.ts`
- `packages/contracts/src/results.ts`
- `fixtures/results/result-engine-fixtures.json`

Do NOT reread the whole repository.

## Mockup Reference

Relevant mock screen(s):

- `docs/design/index.html#results`
- `docs/design/index.html#marks`

Expected behavior:

- The engine's outcomes and displayed values match the fixtures later shown by these screens.

## Verified Behavior

- `integration` is clean at `2b287e3`.
- Result and rule domain modules are empty; no result computation is implemented.
- No implementation or runtime verification was performed during prompt generation.

## Known Limitations / Deferred

- Historic CGPA, grace marks, arbitrary executable formulas, and cross-exam aggregation are outside MVP.
- B02 cannot complete roster/attendance integration until A03/A05 contracts exist.

## Blockers

- NONE for B01.

## Cross-Lane Dependency

Waiting on:

- A03 for Exam, ExamSubject, and approved RegistrationSubject roster before B02 full integration.
- A05 for attendance outcomes and incident hold state before B02/B03 completion.

Other lane needs from us:

- A03 needs the validated grading-policy shape consumed by the result engine; coordinate it under the shared contract lock.

## Next Exact Action

The next Codex session should start by:

1. Read `AGENTS.md`, this handoff, and `docs/codex/generated/B01-result-engine.md`.
2. Confirm the branch/worktree.
3. Inspect the five files listed above and implement B01 immediately.

Do not start by rereading all project documentation.

## Minimal Context Files for Next Session

Required:

1. `AGENTS.md`
2. this `SESSION-HANDOFF.md`
3. `docs/codex/generated/B01-result-engine.md`
4. `packages/domain/src/results/index.ts`
5. `packages/domain/src/rules/index.ts`
6. `packages/contracts/src/results.ts`
7. `fixtures/results/result-engine-fixtures.json`

Read shared docs only if an assumption above is stale or conflicting.
