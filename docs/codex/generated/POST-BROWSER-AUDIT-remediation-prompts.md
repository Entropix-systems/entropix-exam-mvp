# Post-browser-audit remediation prompts

Generated from the 2026-09-14 full-application audit at commit `7fdee3eece280e591a220b56422b033a45b285d2`.

These are implementation prompts, not authorization to merge or deploy. Each prompt owns one independent implementation scope. Preserve unrelated work and read the repository coordination files before changing code.

## Finding-to-prompt map

| Finding | Prompt | Priority | Dependency |
| --- | --- | --- | --- |
| SPEC-CLARIFICATION-001 / BUG-002 | Prompt 1 | NO DEFECT under the approved baseline | Product-rule lock; do not change result semantics without explicit approval. |
| BUG-003 missing platform landing | Prompt 2 | P1 | Coupled to the same role-aware destination policy as BUG-004. |
| BUG-004 role-switch routing mismatch | Prompt 2 | P2 | Implement with BUG-003 to avoid competing routing policies. |
| BUG-005 stretched status badges | Prompt 3 | P2 | Independent. |
| BUG-001 stale login error | Prompt 4 | P3 | Run after Prompt 2 if both touch login navigation/state. |
| ENH-001 dynamic attention card | Prompt 5 | Approved enhancement | Independent; browser comment supplies product approval. |

## Recommended execution order and parallelization

1. Prompt 1 first as a documentation/product-rule correction only; do not change product code.
2. Prompt 2 next; it establishes the role-to-landing contract.
3. Prompts 3 and 5 can run in parallel with Prompt 2 because they own separate web files.
4. Prompt 4 can run in parallel only if Prompt 2 does not edit the same login component; otherwise run Prompt 4 immediately after Prompt 2.
5. Integrate and run the combined role/journey/browser regression last.

## Prompt 1 — correct BUG-002 classification and preserve approved ABSENT semantics

### Objective

Reclassify BUG-002 as `SPEC-CLARIFICATION-001` / `NO DEFECT` under the approved MVP baseline. Do not change result repositories, student-portal grade-card eligibility, exports, persistence, API payloads, or UI aggregate GPA behavior unless the product owner explicitly approves a product-rule change.

### Read first

- `AGENTS.md`
- `docs/codex/CONTRACTS.md`, especially outcome and privacy boundaries
- `docs/codex/ACCEPTANCE.md`, A07, A09, A10, and A12
- `docs/codex/reviews/FULL-APPLICATION-browser-audit-2026-09-14.md`

### Documentation scope

- `docs/codex/reviews/FULL-APPLICATION-browser-audit-2026-09-14.md`
- This remediation prompt
- The approved baseline documents only if a later product decision changes the rule

### Approved behavior to preserve

- An ABSENT subject has no final percentage or subject grade.
- ABSENT remains an explicit outcome and is never converted to a numeric subject score or FAIL.
- For GPA-enabled exams, absent subjects contribute zero grade points and their credits remain in the GPA denominator. Therefore an aggregate GPA such as `0.00` is valid when all credited subjects are absent.
- Released `PASS`, `FAIL`, and `ABSENT` outcomes remain grade-card eligible.
- `WITHHELD` continues to suppress component marks, percentage, GPA, and grade-card access.
- Preserve PASS/FAIL values and deterministic totals.

### Regression protection

- Do not rewrite existing result/student-portal tests to hide aggregate GPA for ABSENT.
- During combined verification, confirm subject percentage/grade remain nonnumeric for ABSENT, aggregate GPA follows the approved denominator rule, and the outcome remains `ABSENT`.
- Confirm WITHHELD privacy and PASS/FAIL numeric aggregates remain unchanged.

### Product-rule lock

- No grading-scale, GPA-denominator, pass-rule, rounding, publication, grade-card-eligibility, or marks-entry redesign.
- No seed-data rewrite.
- No result-semantic code, contract, schema, or migration change.
- Stop and request explicit product approval if aggregate GPA should be hidden for ABSENT or ABSENT grade-card eligibility should change.

### Acceptance

- BUG-002 is no longer presented as a confirmed defect under the current baseline.
- The audit and remediation documentation describe the approved rule consistently.
- No product code changes are made for BUG-002.

## Prompt 2 — add a platform workspace and role-aware landing policy

### Objective

Fix BUG-003 and BUG-004 as one routing scope: provide the platform administrator a usable platform-scoped landing page, and route every login/context switch to a deterministic page authorized for the active role.

### Read first

- `AGENTS.md`
- `docs/codex/CONTRACTS.md`
- `docs/codex/DECISIONS.md`
- `docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md`
- `docs/codex/reviews/FULL-APPLICATION-browser-audit-2026-09-14.md`

### Likely code and test scope

- `apps/web/src/App.tsx`
- Login navigation/component code
- Workspace shell/context selector and role-navigation configuration
- New or existing platform landing page and platform-authorized API client calls
- Route/workspace/login tests
- Seeded credential guide only to reconcile documented route names after the canonical policy is decided

### Required behavior

- `/platform` is an explicit route and renders a useful platform-authorized landing page without calling institution-only overview endpoints.
- A platform administrator lands on `/platform` after login.
- Institution roles land on an authorized institutional route.
- Student roles land on the student portal.
- Multi-role login chooses the documented deterministic active role and its authorized landing.
- Switching roles retains the current route only when the destination role is authorized for it; otherwise route to that role’s landing page.
- Switching Faculty to Invigilator from `/marks` must not leave a permission-denied workspace; it should go to canonical `/attendance`.
- Preserve server-side denial for unauthorized direct routes. Routing is UX, not an authorization substitute.
- Reconcile stale credential-guide aliases (`/conduct`, `/evaluation`) with implemented canonical routes (`/attendance`, `/marks`) or introduce explicit redirects if the product intends to support aliases.

### Platform-page constraint

Use only capabilities already supported by the platform APIs/contracts. If no useful platform data endpoint exists, implement a truthful scoped landing with available session/account context and navigation; do not fake institution metrics or expand API scope silently.

### Regression tests

- Platform login lands on `/platform`, renders without institution-overview denial, and direct `/platform` works.
- Institution admin, controller, faculty, invigilator, auditor, and student logins land on an authorized route.
- Faculty→Invigilator from `/marks` routes to `/attendance`.
- Exam Controller→Auditor retains the route only when auditor-authorized; otherwise uses the auditor landing.
- Unauthorized direct-route behavior remains denied.
- Logout revocation and tenant isolation remain passing.
- Run web route/shell/login tests, role verifier, and representative browser checks.

### Non-goals and locks

- No permission broadening, role-merging, tenant bypass, or API authorization weakening.
- Do not add platform metrics unsupported by current APIs.
- No schema change expected.
- Avoid unrelated navigation redesign.

### Acceptance

- The platform administrator has a usable browser journey.
- No role switch leaves the user stranded on a route the new role cannot use.
- Relevant canonical tenant/assignment/authentication acceptance coverage remains passing; routing remains a UX policy rather than authorization.
- Relevant tests and `git diff --check` pass.

## Prompt 3 — restore compact operational status badges

### Objective

Fix BUG-005 so status badges in marks, attendance, and readiness card headers stay content-sized and correctly aligned at desktop and mobile widths.

### Read first

- `AGENTS.md`
- `docs/codex/reviews/FULL-APPLICATION-browser-audit-2026-09-14.md`
- Evidence: `docs/codex/evidence/browser-audit-2026-09-14/marks-status-layout.jpg`
- Evidence: `docs/codex/evidence/browser-audit-2026-09-14/mobile-attendance.jpg`

### Likely code and test scope

- `apps/web/src/App.css`, especially `.conduct-card > header`, `.evaluation-card > header`, `.status-badge`, and the already-correct overview header pattern
- Existing card/header components only if a shared class is safer than repeated CSS
- Web layout/component tests or focused screenshot assertions

### Required behavior

- `CONDUCT READY`, `SUBMITTED`, approval, and readiness badges remain compact instead of stretching along the cross axis.
- Header text wraps naturally without overlapping or pushing the badge outside the card.
- At narrow widths, the badge may wrap below the title but must remain content-sized and readable.
- Preserve semantic colors, text, and status logic.

### Regression tests

- Verify marks and attendance headers at approximately 1440×900, 1280×800, and 390×844.
- Add a stable DOM/style assertion for `align-self`, computed dimensions, or shared header alignment if screenshot tests are unavailable.
- Check result/readiness headers that reuse the status-badge pattern.
- Run the web test suite and a focused browser visual check.

### Non-goals and locks

- No data, workflow, wording, or permission changes.
- Do not redesign the cards or global color system.
- No schema, API, contract, or decision changes.

### Acceptance

- Badges render as compact pills across affected cards and viewports.
- No horizontal document overflow or title/badge collision is introduced.
- `git diff --check` passes.

## Prompt 4 — clear stale login errors when credentials change

### Objective

Fix BUG-001 so a server authentication error does not remain visible after the user edits/clears credentials or native form validation blocks a new submission.

### Read first

- `AGENTS.md`
- `docs/codex/reviews/FULL-APPLICATION-browser-audit-2026-09-14.md`
- Evidence: `docs/codex/evidence/browser-audit-2026-09-14/login-stale-error.jpg`

### Likely code and test scope

- Login page/form component and its local error state
- Existing login component tests

### Required behavior

- Clear the prior server error when either credential field changes.
- A native required-field validation message must not coexist with a stale server response.
- Preserve generic invalid-credentials wording and suspended-user denial.
- Preserve loading/disabled behavior and do not add account-enumeration detail.

### Regression tests

- Failed login shows the generic error.
- Editing either field clears that error.
- Clearing a required field and submitting leaves only native/client validation state.
- A subsequent failed server request can show the error again.
- Successful login and role-aware navigation remain passing.

### Non-goals and locks

- No authentication API, token storage, password policy, or visual redesign.
- Coordinate with Prompt 2 if both modify the login component.

### Acceptance

- The stale-error reproduction no longer occurs.
- Suspended and invalid logins remain safely generic.
- Web login tests and `git diff --check` pass.

## Prompt 5 — bind “Needs your attention” to the top readiness item

### Objective

Implement approved ENH-001: make the overview attention card derive from the current top pending item in the ordered Exam Readiness checklist.

Product approval was supplied directly in Browser Comment 1 on 2026-09-14. Do not seek duplicate approval for this bounded behavior.

### Read first

- `AGENTS.md`
- `docs/codex/CONTRACTS.md`
- `docs/codex/ACCEPTANCE.md`
- `docs/codex/reviews/FULL-APPLICATION-browser-audit-2026-09-14.md`
- Evidence: `docs/codex/evidence/browser-audit-2026-09-14/northstar-historical-overview.jpg`

### Likely code and test scope

- `apps/web/src/pages/home-page.tsx`
- Existing readiness model/helper used by the left checklist
- Home-page/workspace tests

### Required behavior

- Compute the attention card from the same ordered readiness collection rendered on the left.
- Select the first item that is not complete/ready.
- Show its meaningful label, concise reason/state, and an action that navigates to the matching authorized workflow.
- Do not duplicate readiness calculations or hard-code exam-specific text.
- When no pending item exists, show an explicit all-ready/no-blockers state and the existing result-checklist action.
- The selected exam and role permissions must drive both checklist and attention card consistently.
- If a user lacks access to the ideal destination, provide the nearest authorized explanatory/read-only action; do not expose a dead or denied link.

### Regression tests

- One test for each pending readiness stage selecting the correct first item/action.
- A complete historical exam shows the completion/no-blockers state.
- Changing selected exam updates both the checklist and attention card.
- Role-scoped actions never navigate to unauthorized pages.
- Run home-page/web tests and browser-check current and historical Northstar/Cedar exams.

### Non-goals and locks

- No readiness-rule, workflow-order, authorization, schema, API, contract, or decision changes.
- Do not add a second source of truth or persist presentation state.
- Preserve the existing card’s visual hierarchy except for dynamic content and necessary action labels.

### Acceptance

- The attention card always matches the first pending checklist item.
- Completed exams show a coherent completion state.
- Switching exams cannot leave stale attention copy.
- Relevant tests and `git diff --check` pass.

## Combined release verification

After integrating all applicable prompts:

- Run migration status without creating a migration.
- Run focused API/web tests, full seed smoke, role matrix verifier, and journey verifier.
- Repeat both Northstar and Cedar historical browser journeys.
- Repeat platform, multi-role switch, ABSENT, WITHHELD, suspended-login, marks, and mobile attendance checks.
- Inspect fresh browser console warnings/errors.
- Execute or cite evidence for the canonical A01–A15 assertions separately; do not substitute similarly numbered browser observations for the contractual acceptance matrix.
- Confirm no secrets, passwords, access tokens, or full database URLs are present in logs or committed artifacts.
- Run `git diff --check` and review the complete diff for out-of-scope changes.
