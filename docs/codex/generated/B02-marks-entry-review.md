# B02 — Marks Entry & Independent Review

## Objective

Deliver examiner-scoped marks entry and a persisted DRAFT → SUBMITTED → RETURNED/APPROVED review loop, with independent approval enforced server-side and real roster/attendance integration.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM is complete in another lane — use its actor context; examiner authority comes from EvaluationAssignment, not a new role.
- B01 supplies rule validation/result semantics.
- Mockup reference: [docs/design/index.html — Marks & review](../../design/index.html#marks); preserve its roster, component columns, statuses, review actions, and fixtures.
- Required upstream work: A03 approved RegistrationSubject roster; A05 attendance/incident state for full validation.
- Marks component and batch state enums already exist; `EvaluationModule` is empty.

## Do Not Do

- Do not create an EXAMINER role, trust actor IDs from the client, or allow unassigned faculty to edit.
- Do not treat ABSENT as zero or allow a reviewer to approve their own submission.
- Do not implement result runs/publication or generic workflow infrastructure.
- Do not reread all docs or run broad verification.

## Implementation Scope

Implement:

- EvaluationAssignment, MarksBatch, and Mark persistence.
- Assigned-examiner roster read/save/submit and scoped reviewer return/approve commands.
- Range, component, completeness, attendance, incident, and expectedVersion checks.
- Mockup-aligned Marks & review UI for examiner entry and independent reviewer action.

Do not implement:

- Spreadsheet marks import, moderation committees, publication, or advanced history UI.

## Business Rules

- One active examiner per ExamSubject; only that assignment may edit the batch.
- Mark component columns come from the frozen rule; values are decimal and within component maximum.
- ABSENT has blank external/final mark; held students may retain draft marks but numeric results remain hidden.
- Batch states are DRAFT, SUBMITTED, RETURNED, APPROVED; RETURNED permits edit/resubmit.
- Approver is a scoped controller/HOD distinct from submitter; approval rechecks completeness/range/attendance/incident/version.
- Reopening approved marks requires controller reason and invalidates candidate result inputs.

## Likely Files / Modules

Inspect first:

- `packages/contracts/src/evaluation.ts`
- B01 result/rule implementation
- A03 registration roster contract
- A05 attendance/incident read contract
- `apps/api/src/modules/evaluation/evaluation.module.ts`
- `docs/design/index.html` (`#marks` only)

Likely changes:

- coordinated schema migration
- minimum evaluation assignment/batch/mark commands and DTOs
- `apps/api/src/modules/evaluation/`
- `apps/web/src/`

## Schema / Contract Impact

Schema:

- REQUIRED: EvaluationAssignment, MarksBatch, Mark with tenant-safe FKs, uniqueness, version/history fields, constraints, RLS, and grants.

Shared contracts:

- REQUIRED only for assignment, roster, mark-save, submit, return, and approve DTOs; reuse existing enums.

Use the migration/contract locks and consume A03/A05 records rather than create parallel roster or attendance tables.

## Acceptance

The task is complete when:

- Assigned examiner can save valid draft marks and submit a complete batch.
- Out-of-range, stale, incomplete, unassigned, and attendance-inconsistent input is rejected.
- The submitter cannot approve; an independently scoped reviewer can return or approve.
- The real roster and statuses render in `#marks` and persist after reload.

## Verification

Run only:

- focused range, assignment, submit, return, stale-version, self-approval denial, and independent approval tests
- relevant API/Web/DB typecheck or build
- targeted examiner/reviewer manual flow

## Execution Instruction

Start implementation immediately once A03's roster contract is available. If A05 is not yet merged, implement only the unblocked foundation and do not invent attendance/hold records; record the exact dependency in the handoff. Do not return PLAN ONLY.

## Session Handoff

Before ending, update `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md` in its existing required format. Record usable workflow, exact verification, dependencies consumed or still missing, migrations/contracts, files, blockers, and next action; remove stale facts.
