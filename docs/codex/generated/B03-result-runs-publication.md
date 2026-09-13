# B03 — Result Runs & Publication

## Objective

Deliver the simplest correct persisted compute/review/publish/withdraw flow so approved marks and conduct state produce immutable candidate and student result snapshots, and only the current publication is student-visible.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM and D0 are complete — reuse controller/student scope and tenant transactions.
- B01 provides deterministic calculations; B02 provides approved marks.
- Mockup reference: [docs/design/index.html — Results](../../design/index.html#results); preserve its readiness checklist, summary counts, sample review, statuses, and actions.
- Required upstream work: A03 Exam/input revision, A05 attendance/holds, and completed B02 approvals.
- Result outcome enums exist; `ResultsModule` and Worker result job directory are empty.

## Do Not Do

- Do not recompute student results at read time or expose candidate/draft/withdrawn runs.
- Do not publish stale input revisions or invent distributed worker infrastructure for demo-sized synchronous work.
- Do not allow examiner publication or leak numeric values for WITHHELD.
- Do not reread all docs or run broad suites.

## Implementation Scope

Implement:

- ResultRun, ResultItem, StudentResult, and Publication persistence.
- Controller compute command, candidate summary/read, publish of a specific current run, withdraw with reason, and versioned republish.
- Synchronous computation unless the existing Worker clearly reduces effort.
- Mockup-aligned Results page with blockers, totals, sample review, publish, and withdraw.

Do not implement:

- Cross-exam CGPA, analytics warehouse, distributed orchestration, or production-scale job leasing.

## Business Rules

- Compute requires closed conduct and all subject batches approved; ABSENT/WITHHELD are valid explicit outcomes, while missing required data blocks the run.
- Result snapshots retain rule version, exam inputRevision, checksum, counts, components, grade, points, and reasons.
- Result-affecting changes increment inputRevision; a stale run cannot publish.
- Publishing atomically makes exactly one publication current and advances Exam to PUBLISHED; retry is idempotent.
- Withdrawal removes current visibility without deleting history; correction requires new approved inputs, run, and publication version.

## Likely Files / Modules

Inspect first:

- B01 result/rule implementation
- B02 approved marks repository/service
- A03 Exam/RuleVersion contract
- A05 attendance/incident contract
- `apps/api/src/modules/results/results.module.ts`
- `docs/design/index.html` (`#results` only)

Likely changes:

- coordinated schema migration
- minimum result-run/publication commands and DTOs
- `apps/api/src/modules/results/`
- `apps/web/src/`
- Worker only if already justified by implemented infrastructure

## Schema / Contract Impact

Schema:

- REQUIRED: ResultRun, ResultItem, StudentResult, Publication with immutable snapshots, one-current-publication constraint, versions, tenant-safe FKs, RLS, and grants.

Shared contracts:

- REQUIRED: candidate summary, publication/withdrawal, and current student-result read DTOs; reuse `RESULT_OUTCOMES`.

Use the existing locks and preserve the shared exam inputRevision contract.

## Acceptance

The task is complete when:

- Approved demo data computes persisted results matching B01.
- Missing marks block; ABSENT and WITHHELD are counted without numeric leakage.
- Stale runs cannot publish and retry creates no duplicate active publication.
- Publish exposes only the current snapshot; withdrawal hides it and a later version can become current.

## Verification

Run only:

- focused compute, stale-revision, one-current-publication, retry, withdrawal, ABSENT, and WITHHELD tests
- relevant API/Web/DB typecheck or build
- targeted controller `#results` compute/publish/withdraw flow

## Execution Instruction

Start implementation immediately after required upstream contracts are merged. Do not return PLAN ONLY or wait for PROCEED unless a shared exam revision/schema conflict exists.

## Session Handoff

Before ending, update `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md` in its existing required format. Record snapshot/current-publication behavior, exact verification, migration/contracts, student-read contract, blockers, files, and next action; remove stale facts.
