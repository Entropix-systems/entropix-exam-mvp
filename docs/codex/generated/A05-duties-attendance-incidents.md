# A05 — Duties, Attendance & Incidents

## Objective

Deliver the exam-conduct slice: scoped invigilator duties, mobile-friendly attendance submission, and incident disposition/holds that feed marks and result publication correctly.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM is complete in another lane — enforce assignment scope through its actor context.
- D0 storage may be reused for optional clean incident attachments; do not expand it.
- Mockup reference: [docs/design/index.html — Duties & attendance](../../design/index.html#attendance); preserve its duties, attendance, incident, status, and action patterns.
- Required upstream work: A04 sittings/seats and A03 RegistrationSubject roster.
- Duty and attendance enums already exist; `ConductModule` is empty.

## Do Not Do

- Do not let unassigned or declined invigilators access a roster.
- Do not treat ABSENT as zero, auto-fail a hall, or clear holds implicitly.
- Do not build advanced evidence/document workflows, notifications, or reporting here.
- Do not reread all docs or run broad verification.

## Implementation Scope

Implement:

- Duty assignment, accept, decline, and replacement behavior.
- Attendance draft/save/submit and controller reopen with reason.
- Incident creation, student hold, controller clear/retain-WITHHELD disposition, and hall-incident no-impact close.
- Duties & attendance UI using real assigned sittings and rosters.

Do not implement:

- Automated duty optimization, complex investigations, or production attachment pipelines.

## Business Rules

- Active faculty duties may not overlap; at least one accepted invigilator per HallSitting is required for readiness.
- Only the assigned accepted invigilator may edit during the conduct window; submitted attendance is controller-only reopen.
- Attendance starts NOT_MARKED; PRESENT, ABSENT, and LATE are valid; unresolved NOT_MARKED blocks closure; LATE counts as attended.
- Student-linked open incidents set a result hold; retained holds yield WITHHELD; clearing requires controller reason/audit.
- Hall-wide incidents require affected students or explicit no-result-impact closure.

## Likely Files / Modules

Inspect first:

- `packages/contracts/src/duties.ts`
- `packages/contracts/src/evaluation.ts`
- `packages/db/prisma/schema.prisma`
- `apps/api/src/modules/conduct/conduct.module.ts`
- A04 sitting/allocation code
- `docs/design/index.html` (`#attendance` only)

Likely changes:

- coordinated schema migration
- minimum duty/attendance/incident commands and DTOs
- `apps/api/src/modules/conduct/`
- `apps/web/src/`

## Schema / Contract Impact

Schema:

- REQUIRED: Duty, Attendance, Incident with same-tenant relationships, version/history fields needed by the commands, constraints, RLS, and grants.

Shared contracts:

- REQUIRED: exact incident disposition/hold and attendance roster DTOs. Publish the smallest stable read contract B02/B03 can consume.

Use the existing migration and contract lock protocol.

## Acceptance

The task is complete when:

- Assigned duty accept/decline and roster access are persisted and correctly scoped.
- NOT_MARKED blocks close; ABSENT remains nonnumeric; LATE remains attended.
- An open student incident creates a hold and controller disposition clears or retains it.
- Developer B can consume authoritative attendance and hold state without duplicating records.

## Verification

Run only:

- focused assignment-scope, overlap, NOT_MARKED, ABSENT/LATE, and hold-disposition tests
- relevant API/Web/DB typecheck or build
- targeted manual `#attendance` flow

## Execution Instruction

Start implementation immediately after A04 and lock verification. Do not return PLAN ONLY or wait for PROCEED unless a shared schema/contract conflict exists.

## Session Handoff

Before ending, update `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md` in its existing required format. Record the exact attendance/hold contract Developer B must consume, actual verification, migrations/locks, limitations, blockers, files, and next action; remove stale facts.
