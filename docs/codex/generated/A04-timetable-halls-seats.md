# A04 — Timetable, Halls & Seats

## Objective

Deliver a persisted timetable and deterministic hall/seat allocation flow for approved registration subjects, with the minimum conflict and capacity controls needed to publish a credible demo schedule.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM and D0 are complete — reuse controller scope, tenant transactions, and RLS.
- Mockup reference: [docs/design/index.html — Timetable & halls](../../design/index.html#schedule); preserve its timetable, hall, allocation, status, and action patterns.
- Required upstream work: A03 approved RegistrationSubject roster and ExamSubject IDs.
- Scheduling UUID conventions are already frozen; `SchedulingModule` is an empty shell.

## Do Not Do

- Do not build a timetable optimizer, special-accommodation engine, or multi-attempt scheduler.
- Do not let preview reserve seats or bypass a conflict at commit.
- Do not implement attendance, marks, or result publication.
- Do not reread all docs or run the full suite.

## Implementation Scope

Implement:

- ExamPaper, Hall, HallSitting, and SeatAssignment persistence.
- Paper schedule editing, allocation preview, atomic commit, and schedule readiness/publish command needed by the demo.
- Deterministic seat ordering by roll number within selected room order.
- Mockup-aligned Timetable & halls UI with allocation summary and unallocated students.

Do not implement:

- Automated room choice, optimization, recurring timetable rules, or post-conduct rescheduling.

## Business Rules

- Each ExamSubject has one written paper; times are half-open intervals `[start,end)` and display in the tenant timezone.
- Reject student overlaps, hall overlaps, invalid time ranges, duplicate/over-capacity seats, and foreign tenant references.
- Commit rechecks conflicts under the established scheduling lock and writes allocations atomically.
- Every approved RegistrationSubject is allocated once before publication; seat numbers are deterministic.
- Published revisions are versioned; old admit-card references will be invalidated by B04 when schedule changes.

## Likely Files / Modules

Inspect first:

- `packages/db/prisma/schema.prisma`
- `packages/contracts/src/exam.ts`
- `packages/db/src/tenant.ts`
- `apps/api/src/modules/scheduling/scheduling.module.ts`
- A03 registration roster code
- `docs/design/index.html` (`#schedule` only)

Likely changes:

- coordinated schema migration
- minimum schedule/allocation commands and DTOs
- `apps/api/src/modules/scheduling/`
- `apps/web/src/`

## Schema / Contract Impact

Schema:

- REQUIRED: ExamPaper, Hall, HallSitting, SeatAssignment with tenant-safe FKs, uniqueness, constraints, versions, RLS, and grants.

Shared contracts:

- REQUIRED only for schedule/allocation/readiness DTOs consumed by Web and B04.

Use the existing locks and a single reviewed migration history.

## Acceptance

The task is complete when:

- The demo roster can be scheduled and allocated deterministically, persists, and reloads.
- Hall capacity, hall overlap, and student overlap are rejected server-side.
- Back-to-back half-open sittings are accepted.
- Schedule data exposes stable hall/seat/time/revision values for duties and student outputs.

## Verification

Run only:

- focused successful allocation, capacity, student overlap, hall overlap, and boundary tests
- relevant API/Web/DB typecheck or build
- targeted manual `#schedule` flow

## Execution Instruction

Start implementation immediately after A03 and lock verification. Do not return PLAN ONLY or wait for PROCEED unless a shared schema/contract conflict exists.

## Session Handoff

Before ending, update `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md` in its existing required format. Record actual schedule behavior, revision/ID contracts, verification, lock state, blockers, files to continue, and the next exact action; remove stale facts.
