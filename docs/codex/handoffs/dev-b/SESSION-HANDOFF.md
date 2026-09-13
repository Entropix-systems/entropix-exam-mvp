# SESSION HANDOFF — DEV B

Last updated: 2026-09-14
Branch: `feat/B02-marks-entry-review`
Base: `4e6b052`
Head: current `feat/B02-marks-entry-review` branch tip

## Current Sprint Goal

Working Examination ERP demo for Tuesday. B02 is implemented, focused-verified,
deployed to the shared demo database, and delivered on its feature branch;
integration review and merge remain pending.

## Lane Ownership

Developer B owns result rules, marks/review, result runs/publication, student
outputs, dashboard, reports, and demo polish. Developer A owns academics, people,
exams/registration, scheduling, and conduct.

## Completed in This Lane

- B01 pure result rules are present on the integration baseline.
- B02 persists tenant-safe evaluation assignments, versioned marks batches, and
  decimal component marks with RLS and restricted runtime grants.
- Assigned examiners can read the real A03 approved roster, save drafts, and
  submit only after authoritative A05 conduct state is complete.
- Scoped controllers/department administrators can return or independently
  approve submitted batches; a submitter cannot approve their own batch.
- Controllers can reopen an approved batch with a reason. Marks/review changes
  advance `Exam.inputRevision` for B03 stale-input detection.
- The `/marks` UI uses the frozen rule's component columns, real roster,
  attendance/hold badges, assignment controls, draft save/submit, review, and
  reopen actions.

## Current Task

Task: B02 — Marks Entry & Independent Review
Status: FEATURE BRANCH DELIVERED; AWAITING INTEGRATION REVIEW/MERGE

Usable workflow:

1. Controller or subject-scoped department administrator assigns one active
   same-department faculty member to an exam subject.
2. Only that membership in its session-selected `FACULTY` role sees/edits the
   assigned roster. Other active roles do not inherit the faculty permission.
3. Draft save validates stable roster IDs, configured components, decimal range,
   ABSENT blank rules, and `expectedVersion`.
4. Submit rechecks submitted attendance, unresolved hall incidents, completeness,
   and version, then locks the batch in `SUBMITTED`.
5. An independently scoped reviewer returns with a reason or approves after a
   full recheck. `RETURNED` permits edit/resubmit.
6. A controller may reopen approved marks with a reason; the batch returns to
   `DRAFT` and the exam input revision advances.

## Shared Contracts / Schema

Schema migration:

- `packages/db/prisma/migrations/20260914040000_evaluation_marks_review/migration.sql`
- Adds `Exam.inputRevision`, `EvaluationAssignment`, `MarksBatch`, and `Mark`.
- Uses composite tenant-safe foreign keys, uniqueness/version/value/state/reason
  constraints, forced RLS policies, and `exam_app` CRUD grants.

Typed contracts:

- `packages/contracts/src/evaluation.ts` now defines the evaluation snapshot,
  faculty/assignment/roster/batch/history records, and assignment/save/transition/
  review inputs.
- `packages/contracts/src/exam.ts` exposes `ExamRecord.inputRevision`.
- HTTP mark values are decimal strings; missing values are `null` on save.

Shared project truth:

- `docs/codex/CONTRACTS.md` records the B02 endpoints and authority/version rules.
- `docs/codex/DECISIONS.md` records DEC-010 for assignment authority and
  `Exam.inputRevision`.
- `docs/codex/CURRENT-STATE.md` records implementation status and held locks.

## Locks

- Migration lock: held by Developer B for B02 until the migration is reviewed
  and merged through `integration`.
- Shared contract lock: held by Developer B for B02 until the typed/documented
  contracts are reviewed and merged through `integration`.
- Do not start a competing migration or shared evaluation/result contract while
  these unmerged changes own the locks.

## Files / Modules to Continue From

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260914040000_evaluation_marks_review/migration.sql`
- `packages/contracts/src/evaluation.ts`
- `packages/contracts/src/exam.ts`
- `apps/api/src/modules/evaluation/`
- `apps/api/scripts/evaluation-flow-smoke.ts`
- `packages/db/scripts/seed-evaluation.ts`
- `packages/db/scripts/evaluation-rls-smoke.ts`
- `apps/web/src/evaluation/evaluation-client.ts`
- `apps/web/src/pages/evaluation-page.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/pages/workspace-shell.tsx`
- `apps/web/src/App.css`

The B02 real workflow exposed an A05 nested-write defect. The one-line correction
in `apps/api/src/modules/conduct/conduct.repository.ts` omits an explicit
`tenantId` from nested `IncidentStudent` creation so Prisma can propagate the
tenant-safe parent relation; the real incident-hold workflow then passes.

## Mockup Reference

`docs/design/index.html#marks` remains the UX reference. The implementation keeps
the Marks & review navigation, exam-subject selector, component roster table,
status badges, assignment, submit, return, approve, and reopen actions while
replacing mock state with API/database state.

## Verification Evidence

- `pnpm --filter @entropix/api exec vitest run src/modules/evaluation/evaluation.service.spec.ts`
  → PASS, 1 file / 8 tests.
- `pnpm --filter @entropix/contracts build` → PASS.
- `pnpm --filter @entropix/domain build` → PASS.
- `pnpm --filter @entropix/api typecheck` → PASS.
- `pnpm --filter @entropix/web typecheck` → PASS.
- `pnpm --filter @entropix/db typecheck` → PASS.
- `pnpm --filter @entropix/api build` → PASS.
- `pnpm --filter @entropix/web build` → PASS.
- `pnpm --filter @entropix/db build` → PASS.
- `pnpm --filter @entropix/api lint` → PASS.
- `pnpm --filter @entropix/web lint` → PASS.
- Local API startup and route wiring → PASS after binding `EvaluationService` to
  the existing shared `AUTH_CLOCK` provider.
- `prisma validate` and `prisma generate` for the updated schema → PASS.
- All 14 migrations, including B02 and the subsequently integrated
  `20260914100000_iam_context_switching`, applied to disposable local PostgreSQL;
  `prisma migrate status` → up to date.
- Full fictional local seed chain through `seed:evaluation` → PASS.
- `pnpm --filter @entropix/db smoke:evaluation` against local `exam_app` → PASS;
  3 Cedar assignments plus missing-context/cross-tenant isolation verified.
- `pnpm --filter @entropix/api smoke:evaluation-flow` against local `exam_app` →
  PASS; range/stale/unassigned authority, submit/return/resubmit, self-approval
  denial, independent approval, ABSENT, WITHHELD, history, reopen, and input
  revision were exercised against real repository/database state.
- `prisma migrate deploy` against the configured shared demo database → PASS;
  `20260914040000_evaluation_marks_review` applied, followed by `prisma migrate
  status` reporting all 14 migrations up to date.
- `pnpm seed:evaluation` against the configured shared demo database → PASS;
  3 Cedar assignments across 3 fictional faculty memberships.
- `pnpm --filter @entropix/db smoke:evaluation` against shared demo `exam_app` →
  PASS; assignment visibility and tenant isolation verified through the
  restricted runtime role.
- Targeted browser flow on local ports 5174/3002 → PASS: supplied administrator
  credential, Northstar/Cedar institution access, Cedar controller snapshot,
  assignment-only examiner snapshot, mark save and reload persistence, submit,
  independent return, examiner resubmit, controller approve, approved reload,
  ABSENT blank external mark, WITHHELD display, and reopen action visibility.
  Browser content/overlay checks passed and `window.__consoleErrors` remained empty.

The full workflow and browser checks used disposable local PostgreSQL. The
configured shared demo database has separate migration/status, idempotent seed,
and restricted-role RLS smoke evidence; the mutating workflow smoke was not run
against shared demo data.

## Known Limitations / Deferred

- The supplied fictional credentials and an additional local examiner login are
  stored only in ignored `.local/demo-credentials.md`; no password is tracked.
- Browser evidence is from the disposable local database only; shared demo
  verification intentionally stopped after migration, seed, and RLS smoke.
- Spreadsheet marks import, moderation committees, result computation,
  publication, grade cards, and advanced history UI remain outside B02.
- The real workflow smoke intentionally leaves Cedar MAT10 reopened in `DRAFT`
  so the marks screen remains editable for continued demo work.
- Prisma regeneration changed tracked generated client files broadly because the
  three new relational models add relation input/output surface across existing
  models; review the generated diff separately from handwritten code.

## Blockers

- No implementation blocker remains.
- Integration merge and lock release require review by the task owner.

## Cross-Lane Dependency

- B02 consumed the merged A03 `RegistrationSubject` roster and A05 submitted
  attendance/incident state; it created no parallel roster or conduct tables.
- B03 must wait for the B02 migration/contracts to merge, then consume only
  approved `MarksBatch` inputs and capture/recheck `Exam.inputRevision`.

## Next Exact Action

1. Review the handwritten and generated diffs and the one-line A05 nested-write fix.
2. Merge `feat/B02-marks-entry-review` through `integration`.
3. Release the migration and shared-contract locks in `CURRENT-STATE.md` through
   the integration merge.
4. Resync the B03 branch and consume DEC-010 plus the approved-batch/input-revision
   contracts.

## Minimal Context Files for Next Session

1. `AGENTS.md`
2. this handoff
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/CONTRACTS.md` — evaluation section
5. `docs/codex/DECISIONS.md` — DEC-010
6. `packages/contracts/src/evaluation.ts`
7. `apps/api/src/modules/evaluation/evaluation.repository.ts`
8. `apps/web/src/pages/evaluation-page.tsx`
