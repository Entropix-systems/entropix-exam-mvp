# ExamOS — Round 2 CTA Feedback & Error Handling QA Report

Date: 2026-09-15  
Product: ExamOS by Entropix Systems  
Scope: functional browser audit, systemic remediation, browser re-test, and focused automated verification  
Result: **PASS — Final Acceptance Addendum completed.**

## Summary

| ID | Area | Problem | Severity | Root cause | Final fix | Verification | Status |
|---|---|---|---|---|---|---|---|
| R2-CTA-001 | All mutation screens | Disabled buttons retained idle labels and had no visible progress indicator | P1 | No reusable loading-capable button; page-local busy flags were not rendered into CTAs | Shared accessible `AsyncButton` and action-specific progressive copy | Slow create, save, submit, transition, import, and initialization browser cases | FIXED |
| R2-DUP-002 | Critical mutations | Repeat clicks could enter handlers before React committed disabled state | P0 | UI disabling alone and coarse asynchronous state updates did not form a synchronous exclusivity gate | Shared synchronous `useAsyncAction` gate plus disabled buttons; backend protections preserved | Rapid marks save + gate unit test proving one operation invocation | FIXED |
| R2-NOTIFY-003 | App-wide | Success/action errors were ordinary page-top text or inconsistently absent | P1 | No application-level notification provider; each page owned ad hoc message state | One MUI Snackbar/Alert queue supporting success/error/warning/info | Success and error snackbars observed; accessibility and duration inspected | FIXED |
| R2-CLASS-004 | Setup, masters, students, exams, schedule, conduct, evaluation, results, reports, platform | Action errors and page-load failures shared the same state/presentation | P1 | Pages reused a single `error` variable for query and mutation lifecycles | Persistent page errors remain in-page; mutation errors use toast; 400/422 field errors remain inline | API outage, failed action, invalid CSV, duplicate code, recovery | FIXED |
| R2-MSG-005 | Network, permission, stale conflict, server failures | Technical/generic errors and request IDs could reach ordinary users | P1 | No common API error normalizer; raw `AuthApiError.message`/request metadata rendered directly | Central user-facing normalizer; report action no longer exposes request ID | Network outage browser test; 403/409/500 unit mappings; page-load outage | FIXED |
| R2-IMPORT-006 | Students | Preview and commit shared one boolean busy state, so two CTAs could appear busy | P2 | `importBusy` described the whole feature, not the active import phase | `preview | commit | null` phase state; only relevant CTA spins | Invalid and valid CSV browser journeys; source and build verification | FIXED |
| R2-INCIDENT-007 | Duties & attendance | Incident description was cleared before the request succeeded | P1 | Form state reset occurred immediately after dispatch rather than after awaited success | Action helper returns success; description clears only after successful mutation/refresh | Failure-path code review plus conduct regression/browser journey | FIXED |
| R2-ORDER-008 | Masters, setup/access, students | A success toast could expire while a slow post-mutation refresh still blocked the UI | P1 | Notification was queued before awaiting the canonical data reload | Refresh first, then notify; pending state spans mutation and refresh | Slow campus update: refreshed row and toast visible together | FIXED |
| R2-AUTH-009 | Login, recovery, invitation, logout, context switching | Auth/session CTAs used several incompatible busy patterns and some lacked duplicate protection | P1 | Auth pages and workspace shell bypassed a common async CTA convention | `AsyncButton` on auth/session commands and gate on logout/recovery/context failures | Fresh login, logout, faculty/admin transitions, direct access check | FIXED |
| R2-FORM-010 | Exam and hall forms | Some action eligibility was controlled only by handler state; fast submit could surface remote errors for basic omissions | P2 | Missing native constraints on implemented form inputs | Added `required`, length, numeric, and datetime constraints without changing domain rules | Browser create/hall inspection, typecheck, unit/build gates | FIXED |
| R2-PAGE-011 | Page data loaders | Persistent error container existed, but some server failures still read only `Request failed` | P2 | Page loaders bypassed the shared normalizer after the first remediation pass | Page-load helpers now use the same safe normalizer with page-specific fallback copy | Forced API outage produced `Student directory could not be loaded.` + Retry; recovery restored 100 students | FIXED |

Full inventory: [CTA-INVENTORY.md](../evidence/round-2-cta-feedback-2026-09-15/CTA-INVENTORY.md)  
Browser evidence: [BROWSER-OBSERVATIONS.md](../evidence/round-2-cta-feedback-2026-09-15/BROWSER-OBSERVATIONS.md)  
Command evidence: [QUALITY-CHECKS.md](../evidence/round-2-cta-feedback-2026-09-15/QUALITY-CHECKS.md)

## Final Acceptance Addendum

**Final acceptance status: PASS.** This addendum was completed on 2026-09-15 against the current Round 2 working tree, using Node 24.20.0 and the real local browser/API/database environment.

### Baseline verification of the two API failures

The previously reported `130 / 132` API result was not accepted on assertion. The exact tests were run in the current working tree and in a detached temporary worktree at the commit immediately before Round 2 (`d03f5c1`), without altering the main worktree.

| Test | File / assertion | Current before test correction | `d03f5c1` baseline | First failing commit | Conclusion |
|---|---|---:|---:|---|---|
| `switches context only for an authenticated session` | `apps/api/src/modules/identity/http/auth.controller.spec.ts:138`; expected `switchContext(principal, { institutionId, role })`, received additional `requestId` and `returnToPlatform` fields | failed identically | failed identically | `589c609` (`feat: platform admin`) | PRE-EXISTING stale expectation |
| `rejects signed tokens with missing claims, wrong algorithm/type or invalid binding` | `apps/api/src/modules/identity/security/security.spec.ts:184`; expected a signed `PLATFORM` token carrying optional `tenantId` to reject, but verification resolved a valid platform identity | failed identically | failed identically | `589c609` (`feat: platform admin`) | PRE-EXISTING stale expectation |

Evidence commands used the exact file paths above:

```text
pnpm --filter @entropix/api exec vitest run src/modules/identity/http/auth.controller.spec.ts src/modules/identity/security/security.spec.ts
```

At `589c609` both tests failed identically; at its parent `9b28249` both passed. The corrective test changes preserve application behavior: context switching must forward the generated correlation ID and `returnToPlatform`, and the shared `AccessTokenIdentity` contract explicitly permits `tenantId?: UUID` for platform identities. The current full API suite is now green.

### Identity-client invitation contract audit

The changed browser-client expectation is **valid**: `CreateInvitationRequest` requires `name`, `IdentityApiClient.createInvitation()` serializes the full input, and the Setup & Access invite form collects and supplies that name. The server-side identity implementation, however, was wrong: `IdentityAdminController.invite()` had discarded `body.name` before calling `IdentityAdminService`, whose `normalizedName()` validation correctly requires it. The controller now forwards `name`; `identity-admin.controller.spec.ts` directly locks that HTTP-contract behavior. This is compatible with the real browser invite form and with tenant identity/context requirements; no test was changed merely to fit a broken implementation.

### Mutation succeeded but refresh failed

`useAsyncAction` now provides `runMutationWithRefresh()`, powered by `runMutationAndRefresh()`, which returns one of `success`, `mutation-failed`, `refresh-failed`, or `duplicate`.

- A mutation failure retains inputs/idle recovery and shows the action error.
- A successful mutation followed by a refresh failure never retries the mutation, displays a warning that the write succeeded but current data could not be reloaded, and leaves a persistent **Retry refresh** path.
- Create exam, student import commit, attendance submit, marks save/submit/approval flow, timetable publish, and results publish use action-specific refresh-failure wording where the operation is high impact.
- Focused unit coverage proves a committed mutation is invoked exactly once when refresh rejects and a failed mutation can be safely retried.

### Network-level duplicate-request evidence

The in-app browser was exercised against the real API with a native browser `dblclick` on **Create exam** (`R2-DBLCLICK-1313`). The CTA transitioned to pending, the dialog closed on completion, exactly one new exam rendered, and the operator audit trace recorded exactly one `EXAM CREATED` command at `15/09/2026 13:12:49` (request ID `3903441f-b4ea-4f8e-94ca-202b39c62305`). This is the server-side request-count trace for the browser event.

A separate native rapid close-registration activation produced one `REGISTRATION CLOSED` audit command at `13:10:45` and the expected preparation state. A first attempted parallel automation sequence is explicitly excluded from evidence because that harness serializes its click calls; it created two legitimate sequential creates after the prior request had settled. The native double-click is the valid rapid-activation check.

Student import, attendance, marks approval, and result publication were additionally covered by the same synchronous keyed gate and focused gate tests; the current seeded browser state did not expose a safe fresh commit/approval/publication candidate for repeating destructive commands. Existing backend expected-version/replay safeguards remain in force.

### Async, notifications, diagnostics, and browser regression review

- The keyed gate acquires synchronously before `await`, releases in `finally`, permits retries after rejection, isolates different action keys, and guards post-unmount pending-state updates. Tests cover same-key suppression, unrelated-key isolation, refresh failure, and retry.
- The sole notification channel is MUI `Snackbar` + `Alert`: FIFO queue order, severity-specific durations (errors 7 seconds), manual close, top-right mobile-compatible anchoring, alert semantics, and queue-local duplicate suppression. Suppression is only while an identical message is still queued, so a later independent failure is not hidden. It does not programmatically focus the Snackbar, and the provider is mounted above routes so navigation does not discard queued notices.
- Ordinary error copy no longer includes request IDs. `AuthApiError` retains the ID; development builds emit structured console correlation data, while the operator Reports & Audit surface preserves command request IDs.
- Clean browser regression covered administrator workspace routing, faculty/administrator context behavior, create/update paths, imports, timetable, attendance, marks, approval, results, reports, logout, restricted direct route, and the 390×844 responsive view. It confirmed idle → pending → success, idle → pending → failure with retained input/retry, and the new mutation-success → refresh-failure warning/retry contract through focused automated coverage and the shared UI boundary.

### Final quality gates and totals

| Gate | Final result |
|---|---|
| Frontend typecheck | PASS |
| Frontend lint | PASS |
| Frontend unit tests | **20 files, 64 / 64 tests passing** |
| Frontend production build | PASS (Vite chunk-size advisory only) |
| API typecheck | PASS |
| API lint | PASS |
| Focused identity/API tests | **3 files, 19 / 19 tests passing** |
| Full API suite | **20 files, 133 / 133 tests passing** |
| Browser regression | PASS; real browser plus operator audit request-count trace |
| `git diff --check` | PASS |

### Additional final-pass files changed

- `apps/api/src/modules/identity/http/auth.controller.spec.ts`
- `apps/api/src/modules/identity/http/identity-admin.controller.ts`
- `apps/api/src/modules/identity/http/identity-admin.controller.spec.ts`
- `apps/api/src/modules/identity/security/security.spec.ts`
- `apps/web/src/feedback/use-async-action.ts`
- `apps/web/src/feedback/use-async-action.spec.ts`
- `apps/web/src/feedback/api-error-message.ts`
- `apps/web/src/pages/home-page.tsx`
- `apps/web/src/pages/masters-page.tsx`
- `apps/web/src/pages/setup-access-page.tsx`
- `apps/web/src/pages/exams-page.tsx`
- `apps/web/src/pages/students-page.tsx`
- `apps/web/src/pages/scheduling-page.tsx`
- `apps/web/src/pages/conduct-page.tsx`
- `apps/web/src/pages/evaluation-page.tsx`
- `apps/web/src/pages/results-page.tsx`

## Audit method and scope

The application was run through its documented pnpm/Docker development flow using Node 24.20.0. The initial audit was completed before implementation. The browser used real seeded users and the real API/database; it did not rely on source inspection to guess failures.

Implemented journeys exercised:

- Login, logout, forgot-password/reset/invitation surfaces.
- Platform and institution context behavior.
- Setup/access, membership roles and status controls.
- All academic-master categories.
- Student directory, invalid CSV preview, valid CSV preview/commit, and retry.
- Exam creation, registration transitions, application/controller controls.
- Hall/timetable initialization, schedule/allocation/publish controls.
- Duty assignment/response, attendance, reopen, incidents, and dispositions.
- Marks assignment, draft save, submit, review, approval, and reopen controls.
- Result compute/publish/withdraw controls and blockers.
- Report exports and student document view/print controls.
- Restricted faculty direct-route behavior and 390×844 responsive layout.

No standalone document-upload/generation mutation is implemented. Student document CTAs are synchronous local view/print controls and were intentionally not given artificial loaders.

## Detailed issues and remediation

### R2-CTA-001 — Missing visible mutation progress

**Severity / status:** P1 / FIXED  
**Area / role:** Cross-application; all roles with mutation authority.

**Observed behavior:** Under multi-second requests, controls such as Save draft, Add hall, Initialize timetable, Create exam, Publish, and membership actions could become disabled while retaining their idle label. A user could not distinguish a registered click from a disabled or stalled control.

**Expected behavior:** The triggering control must show a spinner and action-specific progressive text for the complete mutation plus canonical refresh, expose `aria-busy`, and be disabled until settlement.

**Reproduction:** Sign in as Northstar faculty, edit a mark, select Save draft, and inspect during the slow request. Before remediation the button still read `Save draft`; equivalent behavior appeared on controller/admin mutations.

**Root cause:** The application had styled native buttons and page-local `busy` booleans, but no component that translated pending state into visible/accessibility feedback. Each page decided independently whether and how to render busy state.

**Place of action:** `apps/web/src/components/async-button.tsx`, `apps/web/src/App.css`, and mutation CTAs in `apps/web/src/pages/*.tsx`.

**Alternatives considered:**

- Add spinner markup independently to each page. Rejected because copy, semantics, and disabled behavior would drift.
- Use a global full-screen loader. Rejected because it hides action locality and blocks unrelated navigation.
- Add a new toast/loading library. Rejected because MUI was already present and a button needs native semantics, not another dependency.

**Finalized solution:** Added a small native-button-compatible `AsyncButton` with `loading`, mandatory `loadingText`, disabled semantics, `aria-busy`, and a CSS spinner. Replaced mutation buttons while leaving navigation/disclosure buttons alone.

**Why selected:** It preserves the existing classes/design system, works with form submit semantics, provides consistent accessibility, and is small enough not to create a competing component framework.

**Files changed:** `apps/web/src/components/async-button.tsx`, `apps/web/src/components/async-button.spec.tsx`, `apps/web/src/App.css`, and the auth/platform/workspace/setup/masters/students/exams/scheduling/conduct/evaluation/results/reports pages listed in the change inventory below.

**Verification / evidence:** Slow campus save returned `{text: Saving…, disabled: true, aria-busy: true, spinners: 1}`. Slow timetable initialization and marks save retained the spinner until refreshed data arrived. See browser observations and `AsyncButton` tests.

### R2-DUP-002 — Repeat-click race on important commands

**Severity / status:** P0 / FIXED  
**Area / role:** Create, import, submit, approve, publish, status, attendance, marks, and results commands.

**Observed behavior:** Pages generally set React busy state inside an async handler. Two events delivered before the state commit could both enter the operation. Disabling after render reduced risk but did not synchronously guarantee one frontend invocation.

**Expected behavior:** A second activation while a request is active must be ignored without issuing a second business command. Existing API version/idempotency safeguards must remain unchanged.

**Reproduction:** Rapidly double-click a slow Save draft or high-impact command before the disabled render is visible.

**Root cause:** There was no common in-memory exclusive gate, and several pages used one coarse boolean for unrelated commands.

**Place of action:** `apps/web/src/feedback/use-async-action.ts` and each page’s mutation wrapper.

**Alternatives considered:**

- Depend only on the button’s `disabled` prop. Rejected because state commits are asynchronous.
- Debounce clicks. Rejected because time-based suppression can drop a valid retry or allow a long duplicate.
- Change API contracts to add new idempotency keys. Not needed for this UI remediation; existing expected-version, atomic, and replay protections remain authoritative.

**Finalized solution:** Added a synchronous ref-backed action gate that acquires before awaiting, rejects a duplicate invocation, tracks the action key for the correct button, and releases in `finally` so retries work.

**Why selected:** It closes the browser event race, supports action-specific UI, does not modify domain/API behavior, and composes with existing backend defenses.

**Files changed:** `apps/web/src/feedback/use-async-action.ts`, `apps/web/src/feedback/use-async-action.spec.ts`, `apps/web/src/pages/platform-page.tsx`, `exams-page.tsx`, `scheduling-page.tsx`, `conduct-page.tsx`, `evaluation-page.tsx`, `results-page.tsx`, `workspace-shell.tsx`, `forgot-password-page.tsx`, and `reset-password-page.tsx`.

**Verification / evidence:** The unit test starts one unresolved operation, calls the gate again, proves the operation mock has one call, then proves a retry works after failure. Browser rapid-save testing showed one pending action and one completion.

### R2-NOTIFY-003 — No consistent action notification channel

**Severity / status:** P1 / FIXED  
**Area / role:** Cross-application.

**Observed behavior:** Some successful commands produced no explicit acknowledgement; others wrote ordinary text into the page. Mutation failures were mixed with page content and could be far from the initiating control.

**Expected behavior:** Action-level outcomes should use a consistent, accessible, severity-aware, closable notification that does not replace field validation or persistent blockers.

**Reproduction:** Save faculty marks before remediation; wait for the request to finish and find `Marks draft saved.` as ordinary page-top content.

**Root cause:** No app-level snackbar/toast provider existed. Each page independently kept `message`/`error` state.

**Place of action:** `apps/web/src/feedback/notification-context.ts`, `notification-provider.tsx`, and `apps/web/src/App.tsx`.

**Alternatives considered:**

- Keep page-local MUI Alerts. Rejected because placement, duration, and queues would remain inconsistent.
- Introduce a new notification package. Rejected because MUI Snackbar/Alert is already installed.
- Show every outcome inline. Rejected for transient action failures that may be off-screen.

**Finalized solution:** Added one provider with success/error/warning/info severity, top-right anchoring, duplicate suppression, a queue, manual close, alert semantics, and severity-specific durations (3.5/4/5/7 seconds).

**Why selected:** It uses existing dependencies and visual language, centralizes behavior, prevents toast overlap/spam, and preserves accessible semantics.

**Files changed:** `apps/web/src/feedback/notification-context.ts`, `notification-provider.tsx`, `apps/web/src/App.tsx`, and mutation pages.

**Verification / evidence:** Green `Campus updated.` and marks success notifications were observed after refreshed rows/state rendered. The network outage displayed the normalized error snackbar and kept the form open.

### R2-CLASS-004 — Page-load, action, validation, and blocker errors conflated

**Severity / status:** P1 / FIXED  
**Area / role:** All operational pages and roles.

**Observed behavior:** A mutation could write into the same top-of-page error state used when critical initial data failed to load. Conversely, moving every error to toast would have made load failures and workflow blockers disappear.

**Expected behavior:** Field errors remain beside/in the form; mutation/server errors use toast; page-load failures remain persistent with Retry; workflow blockers remain persistent inline.

**Reproduction:** Trigger a duplicate academic code (field/domain validation), stop the API during an update (action error), and stop it before a Students reload (page error).

**Root cause:** Pages used one generic `error` or `message` state and common page-top JSX regardless of lifecycle or recoverability.

**Place of action:** `masters-page.tsx`, `setup-access-page.tsx`, `students-page.tsx`, `exams-page.tsx`, `scheduling-page.tsx`, `conduct-page.tsx`, `evaluation-page.tsx`, `results-page.tsx`, `reports-page.tsx`, and `platform-page.tsx`.

**Alternatives considered:**

- Convert every error to a toast. Rejected because validation and blockers must remain actionable/persistent.
- Leave every error page-level. Rejected because action outcomes are easy to miss and visually detached.
- Build a full form framework migration. Rejected as disproportionate and risky for unchanged domain forms.

**Finalized solution:** Separated query/page error state from mutation feedback; retained existing inline/native form validation; retained readiness/blocker UI; routed operational action failures to the provider.

**Why selected:** It follows the error’s scope and recovery path while minimizing changes to existing form and workflow architecture.

**Files changed:** The ten operational page files above plus shared feedback modules.

**Verification / evidence:** Invalid CSV rows and duplicate master code stayed inline; action outage used a toast; Students load outage stayed visible with Retry; publication/readiness blockers stayed on the page.

### R2-MSG-005 — Unsafe or low-quality operational error copy

**Severity / status:** P1 / FIXED  
**Area / role:** Network failures, authorization failures, stale/version conflicts, exports, server errors.

**Observed behavior:** Pages could render raw API text, `Request failed`, or request IDs. The copy did not consistently tell a user whether to retry, refresh, or request access.

**Expected behavior:** Stable, user-oriented copy without stack traces, storage details, raw HTTP labels, or diagnostic IDs.

**Reproduction:** Stop the API and save a master; induce a duplicate/domain conflict; inspect reports’ previous error construction.

**Root cause:** There was no error normalization boundary. Local helpers returned `AuthApiError.message` verbatim and reports appended request IDs.

**Place of action:** `apps/web/src/feedback/api-error-message.ts`, affected page load/action helpers, and `reports-page.tsx`.

**Alternatives considered:**

- Normalize inside every API client. Rejected for this round because clients also serve programmatic callers and contract semantics should remain unchanged.
- Map only HTTP codes in each page. Rejected as duplicated and inconsistent.
- Always show a generic message. Rejected because 403 and 409 have distinct user recovery actions.

**Finalized solution:** Central mapping for network, 403, 409, and 5xx; preserves safe actionable 400/422 messages for inline use; page loaders supply page-specific fallbacks; report action errors no longer append request IDs.

**Why selected:** One presentation boundary produces consistent UX without altering server envelopes or losing developer-side diagnostics.

**Files changed:** `apps/web/src/feedback/api-error-message.ts`, its spec, platform/masters/setup/students/exams/scheduling/conduct/evaluation/results/reports pages.

**Verification / evidence:** Browser network action showed `Unable to reach ExamOS. Check your connection and try again.`; page outage showed `Student directory could not be loaded.`; unit tests assert 403, 409, 500, and field-error behavior.

### R2-IMPORT-006 — Import phases shared one loading flag

**Severity / status:** P2 / FIXED  
**Area / role:** Students; institution administrator and exam controller.

**Observed behavior:** During commit, both Import students and Confirm import were logically marked busy because one `importBusy` boolean drove both controls, even though only the dialog commit was active.

**Expected behavior:** Preview/upload shows `Validating…`; commit shows `Importing…`; only the active phase’s CTA presents progress.

**Reproduction:** Upload the valid Northstar CSV, wait for 100/100 valid preview, then select Confirm import.

**Root cause:** Busy state represented the feature rather than the active operation phase.

**Place of action:** `apps/web/src/pages/students-page.tsx`.

**Alternatives considered:** Separate `previewBusy` and `commitBusy` booleans; a shared action gate; hide the background button. The two-boolean approach permits invalid combinations, while hiding alone does not fix semantics.

**Finalized solution:** Replaced the boolean with a discriminated `preview | commit | null` phase and derived loading/disabled state for each CTA.

**Why selected:** It makes impossible states unrepresentable and stays local to the two-stage file workflow.

**Files changed:** `apps/web/src/pages/students-page.tsx`.

**Verification / evidence:** Invalid upload displayed only `Validating…`; valid commit displayed `Importing…`; TypeScript and frontend tests/build pass after the refinement.

### R2-INCIDENT-007 — Form data cleared before success

**Severity / status:** P1 / FIXED  
**Area / role:** Duties & attendance; invigilator/controller.

**Observed behavior:** Incident description could disappear immediately after submit, so a network/server failure forced the user to reconstruct the report.

**Expected behavior:** Lock the form while pending and clear the description only after successful persistence and refresh.

**Reproduction:** Fill an incident description and submit while the API is unavailable.

**Root cause:** `setIncidentDescription('')` followed dispatch instead of awaiting the mutation outcome.

**Place of action:** `apps/web/src/pages/conduct-page.tsx` action helper and incident form submit handler.

**Alternatives considered:** Persist the draft in browser storage; optimistic clear plus rollback; retain until confirmed. Browser persistence was unnecessary, and rollback risks losing edits.

**Finalized solution:** The action helper returns a success boolean; the form clears only when it is true. Inputs and CTA are disabled while the action is pending.

**Why selected:** It is deterministic, protects user-entered data, and requires no storage or domain changes.

**Files changed:** `apps/web/src/pages/conduct-page.tsx`.

**Verification / evidence:** Code path is covered by the same awaited action/gate lifecycle; conduct UI was reloaded and its incident controls inspected with pending-state wiring intact.

### R2-ORDER-008 — Toast queued before refreshed success state

**Severity / status:** P1 / FIXED  
**Area / role:** Academic masters, setup/access, student import; administrator/controller.

**Observed behavior:** In an early remediation build, the snackbar timer started before a slow post-command reload. It could disappear before the dialog/page returned to an idle, verifiable state.

**Expected behavior:** Pending spans command plus canonical refresh; success notification begins after the refreshed state is committed.

**Reproduction:** Save a master over the seeded slow API and observe notification timing relative to table refresh.

**Root cause:** The page called `notify()` before `await load()`.

**Place of action:** `masters-page.tsx`, `setup-access-page.tsx`, and `students-page.tsx` mutation success branches.

**Alternatives considered:** Increase toast duration; notify before refresh; refresh optimistically. A longer timer masks rather than fixes sequencing, and optimistic domain state would duplicate server logic.

**Finalized solution:** Await canonical reload first, then enqueue the success toast; keep pending active through both stages.

**Why selected:** Users see the acknowledged outcome and the authoritative refreshed state together.

**Files changed:** The three page files above.

**Verification / evidence:** Campus row `R2QA0915` showed `Round 2 QA Campus Verified` while the green `Campus updated.` notification was still visible.

### R2-AUTH-009 — Inconsistent authentication/session feedback

**Severity / status:** P1 / FIXED  
**Area / role:** Public auth pages and authenticated workspace shell.

**Observed behavior:** Sign-in had progressive copy but no consistent spinner; forgot/reset/invitation and logout/context controls did not all share the same pending and duplicate rules.

**Expected behavior:** Auth commands visibly enter one pending state and reject repeated submission without exposing sensitive technical detail.

**Reproduction:** Submit sign-in, forgot-password, reset/invitation, or logout on a delayed response.

**Root cause:** The flows predated any shared async button/gate and each owned a slightly different busy implementation.

**Place of action:** `login-page.tsx`, `forgot-password-page.tsx`, `reset-password-page.tsx`, `invitation-page.tsx`, and `workspace-shell.tsx`.

**Alternatives considered:** Refactor all auth pages into one form engine; global overlay; shared button/gate. The full form-engine migration was unnecessary and the overlay harms navigation.

**Finalized solution:** Adopted `AsyncButton`; gated recovery/reset/logout; preserved auth-form inline errors and existing success/navigation semantics; context failures use normalized action toasts.

**Why selected:** It aligns auth with the rest of ExamOS without changing token, cookie, route, or authorization behavior.

**Files changed:** The five files above plus shared feedback components.

**Verification / evidence:** Fresh administrator and faculty logins, logout, session restoration, and restricted direct-route journeys passed with no console errors.

### R2-FORM-010 — Missing immediate constraints on create forms

**Severity / status:** P2 / FIXED  
**Area / role:** Exam creation and hall creation; controller/administrator.

**Observed behavior:** Some empty/oversized/basic-invalid input could reach async handlers before the browser provided local feedback.

**Expected behavior:** Immediately actionable input omissions/formats remain at the field/form boundary, while server/domain errors remain toast or dialog-inline as appropriate.

**Reproduction:** Clear required create-exam or hall fields and submit.

**Root cause:** The JSX inputs lacked native constraints even though the server contract already enforced the domain.

**Place of action:** `apps/web/src/pages/exams-page.tsx` and `scheduling-page.tsx`.

**Alternatives considered:** Add a form library; duplicate all contract validation client-side; use native constraints for basic shape. A library/domain duplication would expand scope.

**Finalized solution:** Added `required`, `maxLength`, datetime, and numeric minimum attributes for basic shape only; server remains authoritative for domain rules.

**Why selected:** It improves immediate field feedback with minimal code and no API/business-rule changes.

**Files changed:** The two page files above.

**Verification / evidence:** Forms were exercised in the browser; invalid import/domain validation remained inline; lint/typecheck/build passed.

### R2-PAGE-011 — Page-load copy bypassed the normalizer

**Severity / status:** P2 / FIXED  
**Area / role:** Operational page queries across roles.

**Observed behavior:** The persistent error card and Retry control were correct, but an API-proxy 500 during the final outage test displayed only `Request failed`.

**Expected behavior:** Persistent page state should use contextual, nontechnical copy while retaining Retry.

**Reproduction:** Stop only the API while Vite remains running, navigate from Masters to Students, then select Retry.

**Root cause:** Local page-load helpers still returned raw `AuthApiError.message`; only action catch blocks used `apiErrorMessage`.

**Place of action:** Page-load helpers in platform, masters, setup, students, exams, scheduling, conduct, evaluation, results, and reports.

**Alternatives considered:** Change the API proxy/server error envelope; hardcode `Request failed` replacement in each JSX; route all page helpers through the shared normalizer. Server changes were unnecessary and JSX replacement would duplicate logic.

**Finalized solution:** Routed page-load helpers through the shared normalizer with page-specific safe fallback text.

**Why selected:** It completes the presentation boundary consistently for both queries and mutations while preserving page-level persistence.

**Files changed:** The ten page files listed above.

**Verification / evidence:** During the controlled outage Students displayed `Student directory could not be loaded.` and Retry. After API restart, Retry removed the error only after loading 100 students.

## Systemic findings

These were symptoms of a common implementation gap, not isolated button defects:

- There was no common async CTA abstraction. Page busy state existed, but visual progress, accessible semantics, and action-specific copy were optional.
- Mutation pending identity was usually coarse. A single boolean could not identify which row or workflow phase was active.
- UI disabling did not synchronously gate repeat handler entry.
- There was no central Snackbar/Toast system, so success and action failure state was fragmented across pages.
- Page queries and mutation failures frequently shared one error variable and ordinary page-top rendering.
- API presentation errors lacked a central normalizer; technical or generic response text could leak into UX.
- Most handlers did await their API command, but notification and local-form reset ordering was inconsistent around the subsequent reload.
- Backend concurrency/idempotency safeguards already existed in versioned, atomic, and replay-sensitive workflows. This round preserved them and added the missing frontend protection.

The selected abstractions are deliberately narrow: one button, one notification boundary, one error normalizer, and one exclusive-action hook. They do not introduce a new data-fetching framework or alter domain architecture.

## Final UX standard for ExamOS

| Operation | Required UI lifecycle |
|---|---|
| Query / initial page load | Page/list loading state; failure stays visible with contextual copy and Retry; clear only after successful recovery. |
| Form validation | Native or inline message at the relevant field/dialog; do not rely on a toast as the only signal. |
| Mutation | Triggering `AsyncButton` shows spinner + progressive label + `aria-busy`; disable immediately; synchronous gate rejects repeats; await command and canonical refresh. |
| Mutation success | Return CTA to idle after refresh; use a concise success toast when the outcome is important or otherwise ambiguous. |
| Mutation failure | Return CTA to idle; preserve user input; show a normalized action-level error toast; allow retry. |
| High-impact mutation | Retain existing confirmation/reason flow, then apply the same pending/success/failure lifecycle. |
| Long-running job | If the API becomes accepted/asynchronous, replace an indefinite button spinner with persisted job status/progress and completion/failure notification. |
| Workflow blocker | Persistent inline banner/card until resolved; never toast-only. |
| Diagnostic details | Keep request IDs and internals in logs/audit surfaces intended for operators; do not append them to ordinary action errors. |

Future code should prefer `AsyncButton`, `useAsyncAction`, `useNotification`, and `apiErrorMessage` rather than adding page-local variants.

## Complete file change inventory

Shared infrastructure and tests:

- `apps/web/src/components/async-button.tsx`
- `apps/web/src/components/async-button.spec.tsx`
- `apps/web/src/feedback/api-error-message.ts`
- `apps/web/src/feedback/api-error-message.spec.ts`
- `apps/web/src/feedback/notification-context.ts`
- `apps/web/src/feedback/notification-provider.tsx`
- `apps/web/src/feedback/use-async-action.ts`
- `apps/web/src/feedback/use-async-action.spec.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/App.css`

Pages:

- `apps/web/src/pages/login-page.tsx`
- `apps/web/src/pages/forgot-password-page.tsx`
- `apps/web/src/pages/reset-password-page.tsx`
- `apps/web/src/pages/invitation-page.tsx`
- `apps/web/src/pages/workspace-shell.tsx`
- `apps/web/src/pages/platform-page.tsx`
- `apps/web/src/pages/masters-page.tsx`
- `apps/web/src/pages/setup-access-page.tsx`
- `apps/web/src/pages/students-page.tsx`
- `apps/web/src/pages/exams-page.tsx`
- `apps/web/src/pages/scheduling-page.tsx`
- `apps/web/src/pages/conduct-page.tsx`
- `apps/web/src/pages/evaluation-page.tsx`
- `apps/web/src/pages/results-page.tsx`
- `apps/web/src/pages/reports-page.tsx`

Test-alignment and documentation:

- `apps/web/src/identity/identity-client.spec.ts` (aligns stale expectation with the client’s existing returned `name` field)
- `docs/codex/reviews/ROUND-2-CTA-FEEDBACK-ERROR-HANDLING-QA-2026-09-15.md`
- `docs/codex/evidence/round-2-cta-feedback-2026-09-15/CTA-INVENTORY.md`
- `docs/codex/evidence/round-2-cta-feedback-2026-09-15/BROWSER-OBSERVATIONS.md`
- `docs/codex/evidence/round-2-cta-feedback-2026-09-15/QUALITY-CHECKS.md`

## Quality verification and exceptions

Frontend typecheck, 20 files/61 tests, lint, production build, API typecheck, API lint, `git diff --check`, responsive browser inspection, and browser console/overlay inspection pass.

The full API suite was run with the required network/port access. It reports 130/132 passing. The two failures are in unchanged identity tests and concern an outdated `switchContext` mock call shape and a token-claim expectation. They are outside this web-only remediation and are recorded verbatim in the quality evidence rather than hidden or opportunistically changed.

No API contract, database schema, migration, business rule, route, authorization rule, tenant-isolation behavior, workflow state, or result calculation changed.
