# Final release verification — 2026-09-14

## Decision

**RELEASE GO.** All 15 canonical acceptance assertions are PASS. The fresh clean
checkout, database-plus-object-storage restore, release smoke, complete
configured automated suite, seeded workflows, and browser verification all
passed. There are no open critical/high defects in this release scope.

This is a local release decision for the verified commit. It does not claim that
the new migration has been deployed to the configured Supabase target.

## Verification target

- Repository: `entropix-exam-mvp`
- Branch: `release-evidence-closure`
- Remediation baseline: `1214c56`
- Release-evidence implementation: `88141c60a62fbebda12280b27c8c02c8b6f5f3fc`
- Clean checkout: `/private/tmp/entropix-release-clean-88141c6`
- Runtime: Node `v24.20.0`; pnpm `12.3.4`
- Install: frozen lockfile PASS
- Database: guarded disposable local PostgreSQL; 17 migrations current
- Object storage: local private-object service; referenced-object restore and
  SHA-256 comparison PASS

Full connection strings, credentials, cookies, reset tokens, and signed URLs are
intentionally omitted.

## Legacy DB smoke correction

The four legacy smokes were coupled to total seed counts. They now select their
owned canonical exam/hall fixtures while preserving their security assertions:

| Smoke | Result | Security intent retained |
| --- | --- | --- |
| Exams RLS | PASS | Missing context, foreign IDs, tenant reads/writes, and composite ownership denial. |
| Scheduling RLS | PASS | Tenant hall scope plus missing-context and foreign-tenant denial. |
| Conduct RLS | PASS | Canonical exam duties, valid active states, missing-context and foreign-resource denial. |
| Evaluation RLS | PASS | Canonical exam assignment scope plus missing-context and foreign-resource denial. |

Two application-flow smoke selectors were likewise isolated to their owning
exam so richer historical seed data cannot masquerade as a workflow regression.
The result-flow harness withdraws only its targeted publication and permits an
unrelated valid historical current result. No production result semantics were
changed.

## Canonical A01-A15 matrix

| ID | Result | Executed evidence |
| --- | --- | --- |
| A01 Tenant isolation | PASS | Forced-RLS tenant, academic, people, exam, scheduling, conduct, evaluation, role, portal, storage, and restored-database checks deny missing context and known foreign IDs. |
| A02 Assignment scoping | PASS | Student-own-record, examiner/invigilator assignment, role-matrix, service, and unauthorized direct-route checks pass. |
| A03 Tenant pool reuse | PASS | Sequential, concurrent, missing-context, and post-transaction cleanup checks prove tenant context does not leak. |
| A04 Import integrity | PASS | Preview/reconciliation, invalid atomic rejection, persisted commit, idempotent replay, and cleanup pass. |
| A05 Registration window and eligibility | PASS | Closed window, inactive/ineligible enrolment, foreign ownership, approval snapshot, and approved auto-enrol checks pass. |
| A06 Scheduling concurrency | PASS | Real concurrent races cover student, seat, room/hall, and invigilator. Each race has one winner; losing writes return the expected overlap/stale error and no duplicate allocation persists. |
| A07 Attendance and incidents | PASS | NOT_MARKED close blocking, ABSENT distinction, late/incident holds, post-publication locking, and WITHHELD privacy pass. |
| A08 Marks and approval | PASS | Bounds, optimistic stale rejection, self-approval denial, return/resubmit history, independent approval, and reopen invalidation pass. |
| A09 Result boundaries | PASS | Pure fixtures prove 74 -> PASS/B, failed component threshold, raw 39.995 -> FAIL despite 40.00 display, and GPA 8.20. |
| A10 Result revision race | PASS | Marks/conduct input-revision changes invalidate computed candidates; stale publication is denied. |
| A11 Publication retry and withdrawal | PASS | One-current uniqueness, idempotent retry, withdrawal invisibility, immutable snapshots, and corrected versioned republish pass. |
| A12 Private documents | PASS | Pending, infected/quarantined, pre/post access window, unassigned membership, unauthorized role, foreign tenant, and actual signed-URL expiry denials pass; authorized pre-expiry access succeeds. |
| A13 Worker recovery | PASS | A claimed worker is forcibly terminated; the expired lease is reclaimed, the stale owner is denied, duplicate enqueue converges, and retry creates exactly one tenant/business-key output. |
| A14 Account revocation | PASS | One-time reset, suspension, logout revocation, refresh rotation, replay-family revocation, and continued-access denial pass. |
| A15 Recovery | PASS | A real database dump is restored into a new database and a deleted referenced private object is restored. Counts across 36 tenant tables per tenant, current publication identity/version/checksum, object SHA-256, and restored missing-context RLS all match. |

Totals: **PASS 15 / FAIL 0 / BLOCKED 0 / PARTIAL 0 / NOT TESTED 0**.

## A06, A12, A13, and A15 closure detail

- A06 uses repository writes in actual concurrent promises. Student overlap,
  seat versioning, hall overlap, and invigilator overlap each produce exactly one
  accepted mutation and one expected rejection; fixtures clean themselves up.
- A12 authorizes before signing. Scan state, quarantine, tenant, membership,
  role, assignment, and access-window checks cannot be bypassed by possessing an
  object key. A real short-lived signed URL succeeds before expiry and fails
  afterward.
- A13 persists tenant-scoped leases under forced RLS. Claims use row locking,
  lease expiry and named ownership; stale owners cannot complete. Job and output
  business keys are independently unique.
- A15 compares database state before/after a real dump/restore, including current
  publication identity, version and checksum, then restores and hashes a
  referenced private object and confirms restored RLS denies missing context.

## Fresh clean-checkout verification

The clean checkout was created from `88141c6` with no uncommitted files and used
only its frozen dependency graph and pinned runtime.

| Gate | Result | Detail |
| --- | --- | --- |
| Frozen install | PASS | Node 24.20.0 and pnpm 12.3.4. |
| Migration status/deploy | PASS | 17 migrations found; schema current; no pending migration. |
| `pnpm d0:verify` | PASS | Fixtures, contracts, runtime, tenancy, storage, notifications, typechecks, builds, lint, all unit/integration/API/E2E tests. |
| Domain tests | PASS | 2 files, 32 tests. |
| Worker tests | PASS | 2 files, 5 tests. |
| Web tests | PASS | 17 files, 53 tests. |
| API tests | PASS | 18 files, 127 tests. |
| API E2E | PASS | 1 file, 3 tests. |
| `pnpm smoke:release` | PASS | Four corrected DB smokes, A06, A12, A13, A15, and full historical application smoke. |
| Evaluation/result/portal flows | PASS | Evaluation lifecycle, result compute/revision/publication/withdrawal/republish, and current student portal visibility. |
| Full demo seed/smoke | PASS | Northstar PASS 1/FAIL 1; Cedar PASS 18/ABSENT 1/WITHHELD 1; stable rerun. |
| Role matrix | PASS | 13 usable identities, one expected suspended denial, plus 5 focused files/56 tests. |
| Institution journeys | PASS | Complete Northstar college and Cedar school flows. |
| Bulk imports | PASS | Preview, commit, replay, cleanup, and invalid reconciliation rejection. |
| A15 restore | PASS | Two tenants, 36 scoped tables each, current publications and referenced object restored exactly. |

## Browser verification and persisted evidence

The fresh checkout served Web, API, and Worker together. Verified journeys:

- platform login and reload at `/platform` without institution-only calls;
- invalid and suspended generic login denial, edit-cleared stale error, and
  required-field validation;
- deterministic role landings, Faculty-to-Invigilator reroute, and
  Controller-to-Auditor authorized fallback;
- server-backed denial for a direct unauthorized Faculty route;
- current and historical Northstar readiness/attention states;
- historical Cedar publication and outcome totals;
- PASS numeric result/grade card, ABSENT nonnumeric subject plus approved GPA
  denominator behavior/grade card, and WITHHELD hold-only privacy;
- compact marks/attendance badges with no horizontal overflow; and
- final browser warning/error log inspection: empty.

Fresh captures and their state index are under
`docs/codex/evidence/final-release-2026-09-14/README.md`. The available capture
surface was fixed to desktop dimensions. The prior completed 390x844 remediation
browser check remains valid and the fresh viewport-independent CSS regression
suite passed; no evidence justified reopening BUG-005.

## Result-semantics lock

BUG-002 remains `SPEC-CLARIFICATION-001 / NO DEFECT`:

- PASS and FAIL retain deterministic numeric aggregates.
- ABSENT subject percentage/grade remain nonnumeric. Credited absence remains in
  the GPA denominator with zero grade points, so 0.00 is valid, and released
  ABSENT remains grade-card eligible.
- WITHHELD suppresses component marks, percentage, GPA, and grade-card access.

No result rule, repository, persistence model, contract, API payload,
publication rule, or grade-card eligibility behavior changed.

## Hygiene and residual scope

- `git diff --check`: PASS.
- Secret review: PASS; only fictional `example.test` demo identities exist in
  the repository's pre-existing credential guide.
- Complete implementation diff review: no permission weakening, tenant bypass,
  BUG-002 semantic change, or unrelated product redesign.
- Local verification services were stopped after evidence capture.
- Shared-target migration/deployment and production data validation were not
  authorized and are not claimed.

Final decision: **RELEASE GO for commit `88141c6` on the verified local release
gate.**
