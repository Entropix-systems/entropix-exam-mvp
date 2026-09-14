# SESSION HANDOFF - DEV B

Last updated: 2026-09-14
Branch: `feat/B05-dashboard-reports-demo-polish`
Base / starting HEAD: `b5fe792` (`integration` after PR #10)
Current HEAD: `b5fe792` plus the uncommitted B05 working tree

## Current Task

Task: B05 Dashboard, Reports, Audit & Demo Polish
Status: IMPLEMENTED AND VERIFIED ON DISPOSABLE LOCAL POSTGRESQL; REVIEW/COMMIT/MERGE PENDING

B05 replaces the starter home screen with an authoritative examination overview,
adds role-scoped reports and safe CSV exports, persists real post-migration
command audit events, and aligns workspace navigation/loading/empty/error states
for the Tuesday demo.

## Implemented

- `/` now loads tenant- and active-role-scoped exam counts, readiness steps,
  schedule context, blockers, result-run currency, and publication state.
- `/reports` exposes registration roster, timetable/seating, attendance/incidents,
  evaluation progress, current-result register, and audit exports according to
  the server-resolved active role.
- All CSV fields are quoted, embedded quotes are escaped, and cells beginning
  with `=`, `+`, `-`, or `@` after leading whitespace receive an apostrophe.
- Current-result exports contain only the active publication; WITHHELD rows omit
  percentage and GPA. No access token, question content, or client-asserted
  tenant is included.
- Successful mapped tenant command requests append immutable audit events with
  actor membership, active role, action, target, optional reason, request ID,
  and timestamp. Failed/read/auth requests and allocation previews are excluded.
- Historical seed activity is intentionally absent because it predates audit
  persistence. The UI states that history is empty instead of inferring it.
- Navigation follows the demo journey: Overview, setup, masters, students,
  exams/registration, timetable/halls, duties/attendance, marks/review,
  publication, reports/audit.

## Schema / Contracts / Decisions

- Migration: `20260914150000_audit_events`.
- Model: tenant-owned `AuditEvent` with composite tenant relationships, forced
  RLS, runtime SELECT/INSERT only, immutable update/delete trigger, and unique
  `(tenant_id, request_id)` idempotency.
- The migration applied successfully through Prisma to disposable local
  PostgreSQL. It was not applied to any shared or remote target.
- Shared contracts: NONE. B05 request/response types remain feature-local.
- Decision: `DEC-012 — Request-Level Immutable Audit Events`.
- Migration lock: HELD BY DEV B / B05 until the branch migration merges.

## Verification

Focused automated checks:

```text
pnpm --filter @entropix/api exec vitest run \
  src/modules/audit/csv.spec.ts \
  src/modules/audit/audit.service.spec.ts \
  src/modules/audit/audit.interceptor.spec.ts
  -> PASS (3 files, 8 tests)

pnpm --filter @entropix/web exec vitest run \
  src/audit/audit-client.spec.ts \
  src/pages/home-page.spec.tsx \
  src/pages/workspace-shell.spec.tsx
  -> PASS (3 files, 5 tests)

pnpm --filter @entropix/db typecheck -> PASS
pnpm --filter @entropix/api typecheck -> PASS
pnpm --filter @entropix/web typecheck -> PASS
pnpm --filter @entropix/api lint -> PASS
pnpm --filter @entropix/web lint -> PASS
pnpm --filter @entropix/api build -> PASS
pnpm --filter @entropix/web build -> PASS
pnpm smoke:demo:full-application -> PASS
```

Local repository smoke through the real Audit repository:

```text
Northstar historical
  2 registrations; 3/3 papers; 6/6 seats; 3/3 approved; 0 holds
  CSV rows: registration 4, timetable 6, attendance 7,
            evaluation 6, current result 2

Cedar historical
  20 registrations; 3/3 papers; 60/60 seats; 3/3 approved; 1 hold
  CSV rows: registration 40, timetable 120, attendance 121,
            evaluation 6, current result 40
```

The smoke asserted that WITHHELD current-result rows end with blank percentage
and GPA columns. A Northstar audit event was not visible through the Cedar actor,
providing a direct tenant-scope check in addition to database RLS.

## Browser Evidence

- Northstar institution administrator selected `NORTHSTAR-HIST-2026` and saw
  the complete 2 / 3 / 6 / 3 readiness path and current publication.
- The administrator created fictional local hall `B05-VERIFY`; Reports & Audit
  immediately showed the real `HALL CREATED` event with actor, target, request
  ID, and timestamp.
- Cedar exam controller selected `CEDAR-HIST-2026` and saw 20 registrations,
  3/3 scheduled papers, 60/60 seats, 3/3 independently approved subjects, the
  one WITHHELD hold, and current publication.
- Cedar downloaded each of the five required export kinds from the real API;
  row counts matched the repository smoke. The desktop reports layout rendered
  without a Vite overlay or browser error.

## Important Limitations

- Shared/remote demo schema and data were not mutated or verified.
- The audit interceptor is intentionally request-level for the demo, not a
  transactional outbox. A committed command can survive an audit persistence
  failure; the failure is logged.
- Audit history starts when the migration and B05 API are deployed. It does not
  backfill historical seeded actions.
- Disposable local Cedar `ANNUAL-2026` had pre-existing interactive mutations
  from another running dev session (publication v13 and active holds). The
  isolated historical journey remained authoritative and passed.
- `B05-VERIFY` is fictional verification data in disposable local PostgreSQL
  only; it is not part of the idempotent seed or shared fixtures.

## Next Exact Action

1. Review `git diff --check` and the complete B05 diff.
2. Commit the internally consistent B05 working tree.
3. Merge through `integration`; affected developers pull/rebase and reread
   `CURRENT-STATE.md` plus `DEC-012`.
4. Apply `20260914150000_audit_events` to an explicitly authorized shared demo
   before expecting audit capture there.
5. Rerun the focused B05 checks and both authenticated institution journeys on
   that exact target.

## Minimal Context for the Next Session

1. `AGENTS.md`
2. this handoff
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/DECISIONS.md` (`DEC-012`)
5. `docs/codex/generated/B05-dashboard-reports-demo-polish.md`
6. `apps/api/src/modules/audit/`
7. `apps/web/src/pages/home-page.tsx`
8. `apps/web/src/pages/reports-page.tsx`
9. `packages/db/prisma/migrations/20260914150000_audit_events/migration.sql`
