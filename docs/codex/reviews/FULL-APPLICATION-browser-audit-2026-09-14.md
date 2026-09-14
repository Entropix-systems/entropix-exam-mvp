# Full-application browser audit — 2026-09-14

## Executive summary

**Result: FINDINGS.** The seeded Examination ERP is broadly usable across the two institution journeys and its role-scoped operational surfaces. Authentication, tenant isolation, marks approval, publication, logout revocation, and withheld-result privacy all passed the exercised browser and supporting automated checks.

Four confirmed defects, one product-rule clarification, and one approved enhancement remain:

- **SPEC-CLARIFICATION-001 / BUG-002 — NO DEFECT:** the observed ABSENT aggregate GPA of `0.00` follows the approved GPA-denominator rule. ABSENT subject percentage and grade remain nonnumeric, while absent credits contribute zero points and remain in the aggregate GPA denominator. Do not change this without explicit product approval.
- **P1 — BUG-003:** the platform administrator has no usable platform landing page; both `/` and `/platform` render an institution overview denial.
- **P2 — BUG-004:** initial and switched role context is not routed to an authorized workspace, leaving some users on a denial screen.
- **P2 — BUG-005:** status badges stretch into large pill/blob shapes in operational card headers at desktop and mobile widths.
- **P3 — BUG-001:** a failed-login error remains visible after field edits and native required-field validation.
- **ENH-001 (approved by browser comment):** derive the “Needs your attention” card from the top pending Exam Readiness item instead of hard-coded copy.

The original audit reused A01–A15 labels with browser-specific meanings. The corrected canonical matrix below distinguishes complete, partial, and untested evidence. No product code, schema, migrations, contracts, or decisions were changed during this read-only audit.

## Audit target and method

- Repository: `entropix-exam-mvp`
- Branch: `integration`
- Commit: `7fdee3eece280e591a220b56422b033a45b285d2`
- Application: existing local web/API/worker processes at `http://localhost:5173`, `:3000`, and `:3001`; processes were not restarted or modified.
- Data classification: local disposable seeded database. Connection secrets and full database URL are intentionally omitted.
- Browser method: fresh logins, role changes, direct navigation, responsive viewport checks, and console inspection through the live browser.
- Supporting method: focused API/web tests, role and journey verifiers, migration status, and the full-app smoke script.

The worktree already contained untracked same-day audit artifact paths when the audit began. Those stale audit files were replaced; unrelated product files were preserved.

## Preflight and supporting checks

| Check | Result | Evidence |
| --- | --- | --- |
| API liveness/readiness | PASS | Both endpoints returned HTTP 200; observed response times 0.013s and 0.001s. |
| Worker liveness/readiness | PASS | Both endpoints returned HTTP 200; observed response times 0.126s and 0.001s. |
| Prisma migration status | PASS | 16 migrations found; schema reported current. |
| API focused test suite | PASS | 6 files, 62 tests: auth, guards, evaluation, conduct, student portal, and results. |
| Web focused test suite | PASS | 3 files, 5 tests: workspace shell, login, and student portal. |
| Full-app seed smoke | PASS | Northstar and Cedar historical publications, counts, and outcome fixtures matched expectations. |
| Role matrix verifier | PASS | 13 usable identities, 1 expected suspended-user denial; tenant isolation and logout revocation verified. |
| Journey verifier | PASS | School/college API journeys and PASS/ABSENT/WITHHELD grade-card eligibility assertions completed. |
| Fresh browser warnings/errors | PASS | No warning or error entries returned after a fresh page inspection. |

The repository pins Node 24.20 and pnpm 12.3.4. The available bundled runtime was Node 24.19 with pnpm 11.19, so the pnpm bootstrap guard could not be used in the non-interactive environment. Installed test CLIs and repository scripts were invoked directly. This is an audit-tooling limitation, not an application defect.

## Browser journey coverage

### Northstar College — completed semester journey

The institution administrator selected `NORTHSTAR-HIST-2026` and verified:

- 2 approved registrations across 3 subjects.
- 3/3 scheduled papers and 6/6 subject seats allocated.
- 3/3 independently approved marks batches.
- Input revision 14 has a computed run and publication v1 is visible.
- The result register contains one PASS result at 75% / GPA 8.00 and one FAIL result at 30% / GPA 0.00.
- Setup, academic masters, student list, exams/registration, timetable, marks, publication, reports, and audit surfaces were traversed.
- Logout followed by direct navigation to `/results` returned the user to `/login`.

Evidence: [Northstar historical overview](../evidence/browser-audit-2026-09-14/northstar-historical-overview.jpg).

### Cedar School — completed annual journey

The exam controller selected `CEDAR-HIST-2026` and verified:

- 20 approved registrations, 3/3 scheduled papers, and 60/60 seats allocated.
- 3/3 marks approvals, computed input revision 16, publication v1, and one active hold.
- Result totals: PASS 18, FAIL 0, ABSENT 1, WITHHELD 1.
- WITHHELD numeric details remained hidden in controller and student views.
- The ABSENT row correctly hid subject percentage and displayed aggregate GPA `0.00`, consistent with the approved GPA-denominator rule.

Evidence: [Cedar historical results](../evidence/browser-audit-2026-09-14/cedar-historical-results.jpg) and [withheld student privacy](../evidence/browser-audit-2026-09-14/cedar-withheld-privacy.jpg).

### Student outcomes

- PASS student: approved registration, seat assignment, three papers, published PASS at 75% / GPA 8.00, admit card, and grade card were visible.
- ABSENT student: outcome and subject percentages were nonnumeric, while the portal and grade-card summary displayed aggregate GPA `0.00` as required by the approved GPA-denominator rule (`SPEC-CLARIFICATION-001`, no defect).
- WITHHELD student: only the hold message was shown; component marks, aggregate percentage, GPA, and grade-card access were withheld.

### Operational roles

- Department administrator: scoped navigation and read-only approved marks were usable. No scope violation was observed.
- Faculty/examiner: assigned historical marks were visible and locked after approval.
- Invigilator: only assigned Cedar ENG10/Northstar CS301 sittings were visible; submitted attendance was read-only. Cedar’s seeded ABSENT and LATE attendance states were present.
- Auditor: read-only overview, students, exams, result exports, and audit exports were available; no mutation control was found.
- Multi-role user: role selector remounted navigation and changed permissions, but did not route away from an unauthorized page (**BUG-004**).
- Suspended user: authentication was denied with a generic invalid-credentials message.

## Role and authorization matrix

“Supporting verifier” means the credential and authorization outcome was exercised by the focused role/journey verifier, while a representative peer role received the deeper browser traversal.

| Scenario | Outcome | Basis |
| --- | --- | --- |
| Platform administrator | **FAIL** | Browser: no platform workspace; `/` and `/platform` show institution-overview permission denial. |
| Northstar institution administrator | PASS | Full browser journey. |
| Cedar institution administrator | PASS | Supporting verifier plus tenant journey. |
| Exam controller | PASS | Full Cedar browser journey. |
| Department administrator | PASS | Browser role/scoping check. |
| Faculty/examiner | PASS WITH FINDING | Browser marks check; role-switch destination defect. |
| Invigilator | PASS WITH FINDING | Browser attendance check; Cedar initially activates Faculty instead. |
| Auditor | PASS | Browser read-only surface check. |
| Cedar PASS student | PASS | Full browser student journey. |
| Cedar ABSENT student | PASS | Subject percentage/grade remain nonnumeric; aggregate GPA follows the approved denominator rule. |
| Cedar WITHHELD student | PASS | Full browser privacy check. |
| Northstar student | PASS | Supporting verifier and journey checks. |
| Multi-role context switch | PASS WITH FINDING | Authorization changes, but route remains unauthorized. |
| Suspended user | PASS | Expected authentication denial. |

Summary: **13 usable/expected outcomes, 1 failed scenario, 0 blocked, 0 untested**. “PASS WITH FINDING” is counted as usable because role authorization changed correctly; the destination UX remains defective.

## Acceptance criteria A01–A15

| ID | Result | Audit evidence |
| --- | --- | --- |
| A01 Tenant isolation | PARTIAL | Role verifier confirmed representative cross-tenant denial and browser surfaces remained tenant-scoped; the audit did not independently exercise every read/write/search/export/download path. |
| A02 Assignment scoping | PASS | Focused student-portal, evaluation, and conduct tests plus browser checks covered own-record and assigned-resource boundaries. |
| A03 Tenant pool reuse | NOT TESTED | The browser audit did not induce sequential/concurrent tenant-context reuse or missing-context transactions. |
| A04 Import integrity | NOT TESTED | Mutation/import workflow was intentionally excluded from the read-only browser audit. |
| A05 Registration window and eligibility | PARTIAL | Current and historical registration states were observed, but the complete closed-window/inactive/eligibility snapshot matrix was not exercised. |
| A06 Scheduling concurrency | NOT TESTED | Historical schedules were inspected, but no parallel student/seat/room/invigilator allocation was run. |
| A07 Attendance and incidents | PARTIAL | ABSENT remained distinct from a numeric subject score and WITHHELD hid numeric results; the audit did not independently execute the full NOT_MARKED close-blocking scenario. |
| A08 Marks and approval | PARTIAL | Independent approval and read-only approved batches were verified; the audit report did not contain complete evidence for bounds, stale updates, and return/reopen history. |
| A09 Result boundaries | PARTIAL | Seeded numeric outcomes were checked, but the audit did not cite all canonical 74/B, component-threshold, 39.995, and GPA 8.20 fixtures. |
| A10 Result revision race | PARTIAL | Deterministic result totals passed, but the audit did not independently induce a result-affecting change during computation and reject stale publication. |
| A11 Publication retry and withdrawal | PARTIAL | One current publication was visible; retry, withdrawal, and next-version behavior were not all exercised in this browser audit. |
| A12 Private documents | PARTIAL | WITHHELD grade-card denial was verified, but pending/infected/out-of-window/unassigned download denials and URL expiry were not all exercised. |
| A13 Worker recovery | NOT TESTED | Worker health passed; crash/retry lease recovery was not induced. |
| A14 Account revocation | PARTIAL | Suspension and logout revocation passed; password reset and refresh-token replay were not fully exercised by this audit. |
| A15 Recovery | NOT TESTED | No database and object restore drill was performed against the running local environment. |

Totals: **PASS 1 · PARTIAL 9 · NOT TESTED 5 · FAIL 0 · BLOCKED 0**.

## Product-rule clarification

### SPEC-CLARIFICATION-001 / BUG-002 — ABSENT aggregate GPA

- Classification: **NO DEFECT under the approved MVP baseline**
- Reproduction:
  1. Sign in as the Cedar exam controller and open the published `CEDAR-HIST-2026` result register.
  2. Locate the ABSENT student row.
  3. Sign in as that student and inspect both portal result summary and grade card.
- Approved behavior: an ABSENT subject has no final percentage or subject grade; for GPA-enabled exams, its credits remain in the aggregate denominator with zero grade points. Released ABSENT results remain grade-card eligible. WITHHELD suppresses aggregate GPA and grade-card access.
- Observed: subject percentage/grade are hidden, outcome remains ABSENT, and aggregate GPA displays as `0.00` in controller and student presentations.
- Evidence: [Cedar result register](../evidence/browser-audit-2026-09-14/cedar-historical-results.jpg).
- Decision: preserve current result repositories, student-portal grade-card eligibility, exports, persistence, API payloads, and UI aggregate GPA behavior. A request to hide ABSENT aggregate GPA or remove ABSENT grade-card eligibility is a product-rule change requiring explicit approval and baseline-document updates before implementation.

## Confirmed defects

### BUG-003 — platform administrator has no usable landing page

- Priority: **P1**
- Reproduction: sign in as the platform administrator, then visit `/` and `/platform`.
- Expected: a platform-scoped landing page that does not require institution membership.
- Actual: both paths render the institution overview shell with “Overview unavailable / Permission denied.”
- Likely code path: `apps/web/src/App.tsx` has no platform route/page; its fallback is the institution `HomePage`. The login flow always navigates to `/`.
- Root-cause confidence: **high**.
- Workaround: none in the browser.
- Required regression: route tests for platform login/default landing and direct `/platform` navigation, including absence of institution-only API calls.

### BUG-004 — active role is not routed to an authorized workspace

- Priority: **P2**
- Reproduction A: sign in as Cedar’s Nisha multi-role identity; the active context defaults to Faculty rather than the seeded Invigilator journey.
- Reproduction B: as Northstar’s Faculty/Invigilator identity, open `/marks`, switch to Invigilator, and observe the page remains `/marks` with a permission-denied empty state until Attendance is clicked.
- Expected: login and context switch choose a deterministic authorized landing route for the active role.
- Actual: permissions/navigation remount, but the current URL is retained even when the new role cannot use it.
- Likely code path: login’s unconditional `/` navigation and workspace role-switch handling in the web app.
- Root-cause confidence: **high** for route retention; **medium** for which role should be default because the seeded credential guide and canonical app route names have drifted (`/conduct`/`/evaluation` versus `/attendance`/`/marks`).
- Workaround: manually choose the role and then click an authorized navigation item.
- Required regression: route-aware login and role-switch tests for every multi-role identity, plus reconciliation of credential-guide route labels with canonical routes.

### BUG-005 — status badges stretch into oversized blobs

- Priority: **P2**
- Reproduction: open approved Marks & review or submitted Duties & attendance at desktop or mobile width.
- Expected: compact status badges aligned at the header’s top/right edge.
- Actual: `CONDUCT READY`, `SUBMITTED`, and readiness badges stretch across the header’s cross axis into large pale oval/blob shapes.
- Evidence: [Marks header](../evidence/browser-audit-2026-09-14/marks-status-layout.jpg) and [mobile attendance](../evidence/browser-audit-2026-09-14/mobile-attendance.jpg).
- Likely code path: `apps/web/src/App.css` rules for `.conduct-card > header` and `.evaluation-card > header` use flex layout without `align-items: flex-start`; `.status-badge` therefore stretches. The overview header already demonstrates the correct alignment pattern.
- Root-cause confidence: **high**.
- Workaround: none beyond viewport-specific CSS overrides.
- Required regression: desktop/mobile visual or DOM geometry assertions for compact badges across marks, attendance, and result readiness headers.

### BUG-001 — stale failed-login error survives field edits

- Priority: **P3**
- Reproduction: submit the suspended credentials, clear the fields, then click Sign in.
- Expected: the server error clears when the user edits credentials or when native required-field validation prevents a new request.
- Actual: native “Please fill in this field” appears while the stale “Invalid credentials” message remains.
- Evidence: [stale login error](../evidence/browser-audit-2026-09-14/login-stale-error.jpg).
- Likely code path: login error state is cleared only on a new submit/request, not on input change or before browser constraint validation.
- Root-cause confidence: **high**.
- Workaround: reload the login page.
- Required regression: login component test covering failed submit followed by edits/empty submit.

## Approved enhancement

### ENH-001 — make “Needs your attention” derive from Exam Readiness

- Approval: **approved in Browser Comment 1**.
- Current behavior: the overview’s right-hand attention card uses hard-coded heading/body/action copy, so it can say “No blockers” instead of reflecting the next incomplete readiness step.
- Desired behavior: derive the card from the first/top pending item in the left-hand Exam Readiness checklist. Show that item’s label, concise blocking reason, and destination action. When every item is complete, show an explicit all-ready/completed state with the result-checklist action.
- Value: keeps the summary and detailed readiness model consistent and gives the operator one actionable next step.
- Likely code path: `apps/web/src/pages/home-page.tsx`, where the attention card copy is currently static; reuse the same readiness data/order that renders the checklist.
- Effort/risk: **S–M / low**, provided no new readiness state is invented.
- Non-goals: do not change readiness calculation, permissions, workflow order, schema, or API contracts.
- Regression: component tests for each pending stage and the no-pending completion state.

## Responsive, accessibility, console, and network observations

- Desktop checks used 1440×900 and 1280×800 viewports. Mobile checks requested 390×844; available content viewport was 375×812.
- Student portal cards stack cleanly on mobile and had no document-level horizontal overflow.
- Operational navigation becomes horizontally scrollable on mobile. It remained usable, but active-item discoverability should be watched as navigation grows.
- Mobile attendance remained operable; BUG-005 was more pronounced at the narrow width.
- Native labels, selects, buttons, focusable controls, and validation affordances were present in the traversed flows. A formal screen-reader or automated WCAG scan was not run.
- Fresh console inspection returned no warnings/errors.
- Health checks and all observed page/API requests completed without an application-level availability failure.
- Browser instrumentation denied direct `localStorage` key enumeration. The code/contracts describe memory-only tokens, but this audit could not independently assert browser storage contents; this is **NOT TESTED**, not a product failure.

## Evidence index

| File | Purpose |
| --- | --- |
| [northstar-historical-overview.jpg](../evidence/browser-audit-2026-09-14/northstar-historical-overview.jpg) | Completed Northstar readiness/publication state and source for ENH-001. |
| [cedar-historical-results.jpg](../evidence/browser-audit-2026-09-14/cedar-historical-results.jpg) | Cedar result totals, approved ABSENT aggregate GPA presentation, and readiness badge layout. |
| [cedar-withheld-privacy.jpg](../evidence/browser-audit-2026-09-14/cedar-withheld-privacy.jpg) | WITHHELD student privacy behavior. |
| [marks-status-layout.jpg](../evidence/browser-audit-2026-09-14/marks-status-layout.jpg) | Desktop marks status-badge stretching. |
| [mobile-attendance.jpg](../evidence/browser-audit-2026-09-14/mobile-attendance.jpg) | Mobile attendance layout and stretched status badge. |
| [mobile-student-portal.jpg](../evidence/browser-audit-2026-09-14/mobile-student-portal.jpg) | Mobile student portal layout. |
| [login-stale-error.jpg](../evidence/browser-audit-2026-09-14/login-stale-error.jpg) | Stale failed-login error plus native required-field validation. |

## Limitations and conservative non-findings

- Import mutation/idempotency, scheduling concurrency, worker crash recovery, and recovery/rollback were not exercised; A04, A06, A13, and A15 remain NOT TESTED.
- The browser audit used seeded local data and did not attempt destructive actions.
- Direct storage enumeration was unavailable in the safe browser evaluator.
- No formal assistive-technology pass, load test, cross-browser matrix, or email/document-download content inspection was performed.
- Guessed paths `/scheduling`, `/conduct`, and `/evaluation` falling back to overview are not reported as defects because the implemented canonical routes are `/schedule`, `/attendance`, and `/marks`.
- No tenant leakage, withheld numeric leakage, unexpected audit mutation, console error, or service-health failure was observed.

## Scope and impact

- SPEC-CLARIFICATION-001 / BUG-002 is not a defect under the approved result semantics; changing it would be a product-rule change.
- BUG-003 blocks the platform administrator role entirely in the web UI.
- BUG-004 affects multi-role entry and context-switch UX but did not bypass authorization.
- BUG-005 affects visual integrity across multiple operational cards; data and controls remained usable.
- BUG-001 affects login feedback clarity only.
- ENH-001 is a presentation/data-binding improvement using existing readiness state.

## Prioritized next actions

1. Preserve approved ABSENT aggregate GPA and grade-card behavior unless an explicit product-rule change is approved.
2. Implement a platform-scoped landing route and role-aware destination policy for login/context switches.
3. Fix cross-axis alignment for operational status badges and verify desktop/mobile layouts.
4. Clear stale login errors on credential edits/validation changes.
5. Implement the approved dynamic attention card from the existing ordered readiness model.
6. Execute the canonical A01–A15 verification matrix separately from browser UX observations.

Implementation-ready prompts are in [POST-BROWSER-AUDIT-remediation-prompts.md](../generated/POST-BROWSER-AUDIT-remediation-prompts.md). Continuation state is in [SESSION-HANDOFF.md](../handoffs/browser-audit/SESSION-HANDOFF.md).
