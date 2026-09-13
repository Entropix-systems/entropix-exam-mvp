# B05 — Dashboard, Reports, Audit & Demo Polish

## Objective

After the full examination journey works, connect Overview and Reports & audit to authoritative application data and finish only the navigation, readiness, export, loading, empty, and obvious error behavior needed for a coherent Tuesday demo.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM and D0 are complete — preserve role/tenant scoping and existing audit/request IDs.
- Mockup references: [Overview](../../design/index.html#dashboard) and [Reports & audit](../../design/index.html#reports) in `docs/design/index.html`; preserve their navigation, readiness, counts, terminology, and actions.
- Required upstream work: A01–A05 and B01–B04 main demo paths must work first.
- `AuditModule` is empty and the web app is still being replaced from its starter state.

## Do Not Do

- Do not start this task before the core journey works.
- Do not build advanced analytics, BI infrastructure, report designers, observability platforms, or optional dashboards.
- Do not expose confidential paper contents or unscoped student data in exports.
- Do not redesign the mockup or run broad verification by default.

## Implementation Scope

Implement:

- Overview counts/readiness blockers using the same definitions as operational modules.
- Minimal audit activity view from real command events.
- Simple CSV exports for registration roster, timetable/hall roster, attendance/incidents, evaluation progress, and current result register where data exists.
- Cohesive mockup navigation plus loading, empty, and obvious error states for the demo journey.

Do not implement:

- Custom reports, charts, scheduled exports, enterprise audit search, or advanced accessibility/performance polish.

## Business Rules

- Every count/export is tenant and role scoped and derives from authoritative records.
- CSV output escapes spreadsheet formula prefixes and excludes tokens, question contents, and unauthorized numeric results.
- Audit events retain actor, action, target, reason, and request ID; do not fabricate history.
- Readiness clearly identifies incomplete attendance, incident holds, unapproved marks, stale runs, and unpublished results.

## Likely Files / Modules

Inspect first:

- completed A01–A05 and B02–B04 query services
- `apps/api/src/modules/audit/audit.module.ts`
- `apps/api/src/app.module.ts`
- `apps/web/src/App.tsx`
- `docs/design/index.html` (`#dashboard` and `#reports` only)

Likely changes:

- focused dashboard/report/audit query endpoints
- `apps/api/src/modules/audit/`
- `apps/web/src/`
- shared CSV utility only if reused by multiple exports

## Schema / Contract Impact

Schema:

- NONE for reporting tables. Add AuditEvent only if it is still absent and core commands already have a coordinated audit boundary; this requires the migration lock.

Shared contracts:

- MINIMAL dashboard, readiness, audit-row, and export metadata DTOs only if Web needs them; use the contract lock.

## Acceptance

The task is complete when:

- Overview matches real registration/schedule/attendance/approval/hold/publication state.
- Reports export the current demo data with correct scope and spreadsheet-safe cells.
- Navigation covers the complete mockup journey with credible loading/empty/error handling.
- Both Northstar and Cedar demo paths remain usable; no core rule is replaced by UI-only state.

## Verification

Run only:

- focused dashboard definition, export scoping/escaping, and audit query tests
- relevant API/Web typecheck or build
- one manual school journey and one college journey through the connected navigation

Run broader integration verification only if this task is being prepared for the final integration gate.

## Execution Instruction

Start implementation immediately only after the main path works. Do not return PLAN ONLY or wait for PROCEED unless a shared audit/schema conflict exists.

## Session Handoff

Before ending, update `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md` in its existing required format. Record connected screens, exact counts/exports, verification, schema/contracts, demo limitations, blockers, files, and final integration action; remove stale facts.
