# A03 — Exams & Registration

## Objective

Deliver persisted exam setup and both MVP registration modes: Northstar college student application with controller approve/reject, and Cedar school validated auto-enrol, producing the approved RegistrationSubject roster consumed by scheduling and evaluation.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM is complete in another lane — reuse authenticated student/controller scope.
- D0 and A01/A02 foundations are upstream; do not duplicate their records.
- Mockup reference: [docs/design/index.html — Exams & registration](../../design/index.html#exams); preserve its school/college modes, structure, terminology, statuses, and actions.
- Registration and exam state enums already exist in `packages/contracts`.
- The exact eligibility result/snapshot DTO is the remaining contract-freeze gap.

## Do Not Do

- Do not create arbitrary state PATCH endpoints or accept free-text subjects.
- Do not infer fees or attendance percentage; those systems are outside scope.
- Do not implement timetable, attendance, marks, or publication here.
- Do not reread all project docs or run full verification.

## Implementation Scope

Implement:

- Exam, ExamSubject, immutable RuleVersion snapshot/config, Registration, and RegistrationSubject persistence.
- Exam creation, registration-window commands, college draft/submit/resubmit, controller approve/reject/cancel, and school auto-enrol.
- Server-side eligibility recheck and retained decision snapshot/reviewer/reason/time.
- Mockup-aligned Exams & registration UI using real API state.

Do not implement:

- Supplementary attempts, fee integration, schedule publication, result computation, or generic workflow engines.

## Business Rules

- Eligible means active student, correct exam term/cohort, active enrolled subject, and controller-managed eligibility flag/reason.
- Applications may select only enrolled ExamSubjects; closed windows reject submit/revise.
- Canonical transitions are DRAFT→SUBMITTED, SUBMITTED→APPROVED/REJECTED, REJECTED→SUBMITTED, APPROVED→CANCELLED; auto-enrol may create APPROVED directly after validation.
- Exam/student and registration/subject pairs are unique; retries are idempotent; cross-tenant IDs are inaccessible.
- Opening registration freezes the validated rule version.

## Likely Files / Modules

Inspect first:

- `packages/contracts/src/exam.ts`
- `packages/contracts/src/registration.ts`
- `packages/db/prisma/schema.prisma`
- `apps/api/src/modules/exams/exams.module.ts`
- A01/A02 repositories and tenant patterns
- `docs/design/index.html` (`#exams` only)

Likely changes:

- coordinated schema migration
- minimum exam, grading-policy, eligibility, and registration contracts
- `apps/api/src/modules/exams/`
- `apps/web/src/`

## Schema / Contract Impact

Schema:

- REQUIRED: Exam, ExamSubject, RuleVersion, Registration, RegistrationSubject with tenant-safe uniqueness, versioning, snapshots, RLS, and grants.

Shared contracts:

- REQUIRED: exact eligibility/snapshot shape plus minimum exam/registration commands and DTOs. Coordinate the grading-policy shape with Developer B; do not create a competing result-rule definition.

Use the existing migration and contract lock protocol.

## Acceptance

The task is complete when:

- Northstar application submit/approve/reject/resubmit works with persisted state.
- Cedar auto-enrol creates approved registrations only for eligible enrolled subjects.
- Inactive/foreign/closed-window/unenrolled inputs are rejected server-side.
- Approved RegistrationSubject UUIDs form a stable roster for A04/A05/B02.

## Verification

Run only:

- focused eligibility and transition tests, including inactive student and foreign tenant
- relevant API/Web/DB typecheck or build
- targeted Northstar application and Cedar auto-enrol manual flows

## Execution Instruction

Start implementation immediately after A01/A02 and lock verification. Do not return PLAN ONLY or wait for PROCEED unless the eligibility/grading shared contract conflicts with Developer B.

## Session Handoff

Before ending, update `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md` in its existing required format. Record stable IDs/contracts Developer B must consume, actual verification, lock state, limitations, blockers, relevant files, and the next exact action; remove stale facts.
