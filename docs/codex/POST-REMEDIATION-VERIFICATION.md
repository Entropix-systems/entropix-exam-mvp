# Post-remediation verification — 2026-09-14

## Outcome

The requested post-browser-audit remediation is **complete and GO for its scoped
changes**. BUG-003, BUG-004, BUG-005, BUG-001, and ENH-001 are implemented with
regression coverage. BUG-002 is documented as `SPEC-CLARIFICATION-001 / NO
DEFECT`; its approved result behavior is unchanged.

The broader canonical A01–A15 release gate remains **NO-GO** because A06 and A12
are only partially evidenced and A13 and A15 were not exercised. Four legacy
fixture-count RLS smokes also remain incompatible with the richer full-application
seed. Those gaps predate and are outside this remediation; they are recorded
below instead of being hidden or fixed by unrelated changes.

## Verification target

- Repository: `entropix-exam-mvp`
- Branch: `integration`
- Base/HEAD commit: `7fdee3eece280e591a220b56422b033a45b285d2`
- Verified target: the remediation working tree on that commit; no remediation
  commit was created during this task.
- Database: guarded disposable local PostgreSQL `exam_mvp`; full connection data
  is intentionally omitted.
- Migration state: 16 migrations found, schema current; no migration created.
- Tooling note: the repository pins Node 24.20 and pnpm 12.3.4, while the bundled
  runtime provides Node 24.19 and the installed package graph was created with
  pnpm 11.19. Tests and scripts were therefore run through the installed package
  CLIs with the bundled Node runtime, matching the audit environment.

## Remediation acceptance

| Scope | Result | Evidence |
| --- | --- | --- |
| Documentation correction | PASS | Audit, remediation prompt, handoff, and seeded route guide consistently classify BUG-002 as no defect and restore the canonical A01–A15 matrix. |
| BUG-003 platform landing | PASS | Explicit `/platform` route and platform-only page use authenticated account context without requesting institution overview data. Unit and live login/reload checks pass with no console error. |
| BUG-004 role-aware routing | PASS | One active-role route policy drives login, navigation, and context switches. Institution Admin→`/masters`, Controller→`/results`, Department Admin/Faculty→`/marks`, Invigilator→`/attendance`, Auditor→`/`, Student→`/student`. Faculty→Invigilator and Controller→Auditor checks pass. Forced unauthorized Faculty `/attendance` remains server-denied. |
| BUG-005 compact badges | PASS | CSS regression assertions pass. Live marks/attendance/result checks show content-sized pills without overflow at 1440×900, 1280×800, and a requested 390×844 mobile viewport. |
| BUG-001 stale login error | PASS | Reducer/component coverage proves failed login, edit clearing, native required validation, repeated failure, and successful navigation. Live suspended-login reproduction leaves only native validation after editing/clearing. |
| ENH-001 dynamic attention | PASS | The first non-complete ordered readiness step drives the card and authorized action; all six stages, all-ready state, selected-exam changes, and restricted-role fallbacks are covered. Northstar and Cedar current/historical browser checks match their rendered readiness lists. |

## Result-semantics lock

No result repository, persistence model, API payload, grading rule, publication
rule, or grade-card eligibility logic changed.

- PASS remains numeric and grade-card eligible (browser fixture: 75.00%, GPA
  8.00).
- ABSENT remains explicit; subject percentage and grade are nonnumeric. Its
  credited subjects contribute zero points while remaining in the GPA
  denominator, so the verified aggregate GPA is 0.00. Released ABSENT remains
  grade-card eligible.
- WITHHELD shows only the hold state and suppresses components, percentage, GPA,
  and grade-card access.

This is the approved BUG-002 baseline. Changing it requires explicit product-rule
approval.

## Automated verification

| Check | Result | Totals/details |
| --- | --- | --- |
| Web tests | PASS | 17 files, 53 tests. |
| Web typecheck / ESLint / production build | PASS | Typecheck and lint clean; 59 modules transformed, all generated chunks below the 500 kB warning threshold. |
| API tests | PASS | 18 files, 127 tests. |
| API E2E | PASS | 1 file, 3 tests. |
| API typecheck / lint / production build | PASS | Clean. |
| Domain tests / typecheck | PASS | 2 files, 32 tests. |
| Worker tests / typecheck / lint / build | PASS | 1 file, 2 tests; health-focused worker baseline remains green. |
| Contracts smoke / typecheck | PASS | Contract serialization/fixture smoke and typecheck clean. |
| D0 fixtures | PASS | Fixture consistency smoke clean. |
| Storage lifecycle | PASS | Quarantine, clean scan/promotion, infected retention, generated private object, and signed download exercised. |
| Notification smoke | PASS | Accept/fail and business-state isolation exercised. |
| Migration status | PASS | 16 migrations current. |
| Runtime and tenant RLS smokes | PASS | Missing context denied; both tenants isolated; known foreign ID and composite-FK writes denied; concurrent pool reuse and post-transaction cleanup pass. |
| Academic / People RLS smokes | PASS | Tenant scoping and missing-context denial pass. |
| Full-application smoke | PASS | Northstar: 2 students, PASS 1 / FAIL 1. Cedar: 20 students, PASS 18 / ABSENT 1 / WITHHELD 1. |
| Seeded role matrix | PASS | 13 usable identities, 1 expected denial; logout revocation and tenant isolation verified after route-metadata correction. |
| Journey verifier | PASS | College/school journeys plus PASS/ABSENT/WITHHELD privacy and grade-card eligibility. |
| Bulk-import verifier | PASS | Preview, atomic commit, persisted graph, idempotent replay, cleanup, and invalid reconciliation rejection. |

The full API suite initially could not bind its ephemeral test port inside the
sandbox; it passed when rerun with local runtime access. Contract smoke required
the same treatment for its IPC transport. These were execution-environment
restrictions, not application failures.

## Legacy smoke incompatibilities

Four older DB smokes fail after the full-application seed because they assert
exact pre-demo fixture shapes:

| Smoke | Current result | Reason |
| --- | --- | --- |
| Exams RLS | FAIL | Expects one Northstar exam; the full demo intentionally contains current and historical exams. |
| Scheduling RLS | FAIL | Expects two Cedar halls; the full demo contains three. |
| Conduct RLS | FAIL | Expects three duties; the full demo contains six. |
| Evaluation RLS | FAIL | Its Cedar evaluation fixture predicate no longer matches the full-demo graph. |

The authoritative full-application smoke, role matrix, journey verifier, service
tests, and tenant/RLS smoke pass against that graph. The legacy scripts should be
made invariant-based or run against their original isolated seed before the
overall release gate is declared green.

## Browser verification

The browser pass repeated platform, role-switch, unauthorized direct-route,
suspended login, both institution histories, readiness-card, PASS, ABSENT,
WITHHELD, marks, attendance, desktop, and mobile scenarios.

| Scenario | Result |
| --- | --- |
| Platform login, `/platform`, and reload | PASS; no institution-overview request or denial. |
| Institution role landings | PASS for Institution Admin, Controller, Department Admin, Faculty, Auditor, and Student. |
| Multi-role switching | PASS; Faculty `/marks` → Invigilator `/attendance`; Controller `/results` → Auditor `/`. |
| Direct unauthorized route | PASS; active Faculty forced to `/attendance` receives `Permission denied`. |
| Northstar current / historical readiness | PASS; Academic setup is the first current blocker, while historical is all-ready. |
| Cedar current / historical readiness | PASS; current and historical attention cards match the first non-complete step. |
| Status badge geometry | PASS; marks badge/header ratios were 149.42/1079 at 1440×900 and 149.42/919 at 1280×800; mobile attendance was 84.92/341; mobile results was 71.77/341. No horizontal overflow. |
| Login stale-error reproduction | PASS; editing clears the server error and empty submission exposes only native required-field validation. |
| Student result privacy | PASS; PASS numeric/card, ABSENT nonnumeric subject plus approved aggregate GPA/card, WITHHELD hold-only. |
| Console | PASS; final fresh warning/error inspection returned none. |

Fresh browser screenshots were captured and reviewed inline during verification.
The browser-control surface returned pixel buffers without a workspace export
path, so the pre-remediation audit screenshots remain the persisted files under
`docs/codex/evidence/browser-audit-2026-09-14/`; they are not misrepresented as
post-remediation captures.

## Canonical A01–A15 matrix

`EXECUTED` identifies checks rerun in this remediation. `CITED` identifies exact
accepted repository evidence that remains valid because the remediation did not
touch the underlying domain/API/storage behavior.

| ID | Result | Basis |
| --- | --- | --- |
| A01 Tenant isolation | PASS | EXECUTED: tenant/RLS smoke, role matrix, scoped services, known foreign-ID and composite-FK denial; audit export guard and student document ownership tests cover the non-DB surfaces. |
| A02 Assignment scoping | PASS | EXECUTED: student portal, evaluation, conduct, role matrix, and browser direct-route denial. |
| A03 Tenant pool reuse | PASS | EXECUTED: missing-context, sequential, concurrent pool reuse, and post-transaction leak checks. |
| A04 Import integrity | PASS | EXECUTED: malformed/duplicate reconciliation, atomic invalid rejection, persisted commit, idempotent replay, and cleanup. |
| A05 Registration window and eligibility | PASS | EXECUTED: closed window, inactive user, foreign ownership, eligibility decision snapshot, and approved auto-enrol tests. |
| A06 Scheduling concurrency | PARTIAL | Deterministic seats, capacity rejection, student/hall overlap, half-open intervals, and publication blocking pass. A real parallel allocation race covering student, seat, room, and invigilator together was not induced. |
| A07 Attendance and incidents | PASS | EXECUTED: NOT_MARKED close block, ABSENT distinction, LATE handling, hold derivation, post-publication lock, and WITHHELD browser privacy. |
| A08 Marks and approval | PASS | EXECUTED service checks plus CITED real persistence flow cover bounds, stale versions, self-approval, return/resubmit history, independent approval, and reopen invalidation. |
| A09 Result boundaries | PASS | EXECUTED domain fixtures cover 74→PASS/B, component-threshold failure, raw 39.995 boundary failure with 40.00 display, and exact GPA 8.20. |
| A10 Result revision race | PASS | EXECUTED service stale-run checks plus CITED persistence flow prove a post-compute conduct change advances `inputRevision` and blocks stale publication. |
| A11 Publication retry and withdrawal | PASS | EXECUTED service/migration checks plus CITED persistence flow cover one-current uniqueness, idempotent retry, withdrawal invisibility, corrected versioned republish, and immutable snapshots. |
| A12 Private documents | PARTIAL | Storage scan/promotion and signed download pass; WITHHELD and unauthorized-role document denial pass. Full pending/infected/out-of-window/unassigned download denial and signed-URL expiry were not all exercised through the application authorization surface. |
| A13 Worker recovery | NOT TESTED | Worker liveness/tests pass, but no expired-lease resume or duplicate-current-output crash recovery was induced. |
| A14 Account revocation | PASS | EXECUTED persistence/service/security tests cover one-time reset, session revocation, refresh rotation/replay-family revocation, suspension, and logout revocation. |
| A15 Recovery | NOT TESTED | No database-plus-referenced-object restore drill was performed. |

Totals: **PASS 11 · PARTIAL 2 · NOT TESTED 2 · FAIL 0 · BLOCKED 0**.

## Scope, hygiene, and final decision

- `git diff --check`: PASS.
- Complete diff review: no schema, migration, shared contract, API permission,
  result-semantic, seed-data outcome, or unrelated visual redesign change.
- Secret review: no real credentials, access/reset tokens, cookies, password
  hashes, or full database URLs were added to logs or artifacts. The seeded
  credential guide continues to contain only its explicitly documented fictional
  `example.test` demo password.
- Started verification watchers were stopped; the pre-existing local services
  were not terminated.

Decision: **GO for the requested remediation scope. NO-GO for declaring the full
canonical release gate complete** until A06, A12, A13, and A15 receive complete
evidence and the four seed-coupled legacy smokes are isolated or corrected.
