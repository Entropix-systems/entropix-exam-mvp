# SESSION HANDOFF — DEV A

Last updated: 2026-09-13
Branch: integration
Base: 2b287e3
Head: 2b287e3

## Current Sprint Goal

Working Examination ERP demo for Tuesday.

IAM is complete in another developer's lane. Do not rebuild or re-analyze IAM unless a concrete integration blocker requires it.

## Lane Ownership

Developer A owns:

- academic masters
- students, faculty, enrolments, and demo import
- exams and registration
- timetable, halls, seats, duties, attendance, and incidents

Developer B owns:

- result rules
- marks entry and independent review
- result runs and publication
- student outputs, dashboard, reports, and demo polish

## Completed in This Lane

- No business slice is complete on `integration`.

## Current Task

Task: A01 — Academic Masters
Status: NOT STARTED

What already works:

- D0 workspace, API, database, tenant transaction/RLS, storage, notification, CI, and fictional fixtures exist.
- Shared state enums and API conventions exist in `packages/contracts`.
- `docs/design/index.html#setup` defines the practical demo screen.

What remains:

- Persist and expose Campus, Department, Program, AcademicYear, Term, Cohort, and Subject.
- Replace the relevant mock screen with tenant-scoped UI and API behavior.

## Stable Context for Next Session

The next agent may assume:

- IAM is complete in a parallel lane and should be consumed, not changed.
- D0 foundation remains available.
- Current business API modules are empty Nest module shells.
- Current Prisma schema contains only Tenant, User, Membership, and RoleGrant.
- Current web app is the Vite starter; the interactive reference is `docs/design/index.html`.
- The demo tenants and fixtures are Northstar College and Cedar School.
- All tenant-owned persistence must use the existing tenant transaction and RLS model.

## Shared Contracts / Schema That Matter

- Typed contracts already define exam, registration, attendance, duty, marks-batch, and result outcome enums.
- The exact eligibility payload is not frozen yet.
- Developer B will consume `Exam.id`, `ExamSubject.id`, `RegistrationSubject.id`, attendance state, and incident hold state.

## Migrations

Latest relevant migration:

- `20260911063050_identity_tenancy_rls`

Migration lock:

- DEV B, according to the current `CURRENT-STATE.md`; no D1 business migration exists on `integration`.

Required action:

- Coordinate transfer or a single shared migration sequence before A01 edits schema.

## Shared Contract Lock

Owner:

- DEV A, according to the current `CURRENT-STATE.md`.

Relevant shared contract change:

- Add only the academic IDs/DTOs needed by A01, then preserve or explicitly transfer the lock for dependent tasks.

## Files / Modules to Continue From

Read these first next session:

- `docs/codex/generated/A01-academic-masters.md`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/tenant.ts`
- `apps/api/src/modules/academics/academics.module.ts`
- `apps/web/src/App.tsx`

Do NOT reread the whole repository.

## Mockup Reference

Relevant mock screen(s):

- `docs/design/index.html#setup`

Expected behavior:

- Northstar College and Cedar School academic structure loads from persisted tenant-scoped state.

## Verified Behavior

- `integration` is clean at `2b287e3`.
- Business modules are placeholders, the result engine is empty, and the web app is still the Vite starter.
- No implementation or runtime verification was performed during prompt generation.

## Known Limitations / Deferred

- CSV is the required demo import path; XLSX may be deferred if it would require an import framework.
- Advanced scheduling optimization, enterprise import reconciliation, and broad hardening are deferred.

## Blockers

- A01 schema work needs the single migration lock currently recorded as DEV B.

## Cross-Lane Dependency

Waiting on:

- IAM integration from the parallel developer only when an actor-context integration point is required.

Other lane needs from us:

- A03: Exam, ExamSubject, and approved RegistrationSubject roster.
- A05: Attendance outcomes and incident hold state.

## Next Exact Action

The next Codex session should start by:

1. Read `AGENTS.md`, this handoff, and `docs/codex/generated/A01-academic-masters.md`.
2. Confirm the branch/worktree and coordinate the migration lock.
3. Inspect the five files listed above and implement A01 immediately.

Do not start by rereading all project documentation.

## Minimal Context Files for Next Session

Required:

1. `AGENTS.md`
2. this `SESSION-HANDOFF.md`
3. `docs/codex/generated/A01-academic-masters.md`
4. `packages/db/prisma/schema.prisma`
5. `packages/db/src/tenant.ts`
6. `apps/api/src/modules/academics/academics.module.ts`
7. `apps/web/src/App.tsx`

Read shared docs only if an assumption above is stale or conflicting.
