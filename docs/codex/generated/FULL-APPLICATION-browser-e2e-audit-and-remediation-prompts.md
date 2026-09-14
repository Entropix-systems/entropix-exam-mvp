# Full Application — Browser E2E Audit, Findings, Handoff & Remediation Prompts

## Invocation

Open a fresh Codex task in this repository, attach the Codex Browser capability
with `@Browser`, and ask Codex to execute this file:

```text
Read and execute
docs/codex/generated/FULL-APPLICATION-browser-e2e-audit-and-remediation-prompts.md.
Use the attached Browser capability for the real end-to-end application audit.
Do not stop at a chat summary: write every required Markdown artifact before
finishing.
```

This is an audit and planning session. Do not fix product code during this
session. The outputs must let later Codex sessions implement verified fixes and
approved enhancements without relying on this chat history.

## Objective

Test the connected Examination ERP end to end through the real browser and API,
covering Northstar College and Cedar School, all meaningful roles, the complete
examination journey, authorization boundaries, error states, and obvious visual
or usability problems.

Produce:

1. one evidence-backed Markdown report containing bugs and enhancements;
2. one resumable audit-session handoff;
3. one Markdown remediation prompt pack containing a small number of cumulative,
   optimized implementation prompts grouped by dependency and risk — never one
   prompt per finding.

## Required Repository Context

Before testing, read only:

1. `AGENTS.md`
2. `docs/codex/CONTEXT.md`
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/CONTRACTS.md`
5. `docs/codex/DECISIONS.md`
6. `docs/codex/ACCEPTANCE.md`
7. `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md`
8. `docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md`
9. `docs/codex/generated/FULL-APPLICATION-demo-seed-and-flow-test.md`
10. this prompt

Then inspect only the code needed to verify a browser observation. Repository
state and actual runtime behavior are authoritative; prior handoffs and expected
screens are claims to verify, not proof.

## Required Output Artifacts

Create these files, using the actual audit date as `YYYY-MM-DD`:

```text
docs/codex/reviews/FULL-APPLICATION-browser-audit-YYYY-MM-DD.md
docs/codex/handoffs/browser-audit/SESSION-HANDOFF.md
docs/codex/generated/POST-BROWSER-AUDIT-remediation-prompts.md
```

Create the parent folders if absent. Store curated screenshots under:

```text
docs/codex/evidence/browser-audit-YYYY-MM-DD/
```

Do not place passwords, tokens, cookies, connection strings, reset links,
database details, or real personal data in any artifact or screenshot. Refer to
the tracked fictional credential file by role/scenario instead of copying its
passwords.

## Non-Negotiable Boundaries

- Audit first; do not modify application code, schema, migrations, shared
  contracts, fixtures, or product documentation.
- Do not commit, push, merge, deploy, seed, reset, or mutate a shared/remote
  target unless the user explicitly authorizes that exact action and target.
- Prefer read-only journeys. For necessary command-path verification, use only
  fictional disposable data with a unique `E2E-AUDIT-<timestamp>` marker and
  record every mutation and cleanup status in the handoff.
- Never use destructive result-flow scripts against shared demo data.
- Do not change acceptance criteria to make behavior look correct.
- Do not classify an untested assumption as a bug.
- Do not fabricate console, API, database, authorization, or browser evidence.
- Preserve tenant isolation, assignment scope, independent approval, ABSENT,
  WITHHELD, schedule/capacity checks, and draft/publication visibility.
- Leave pre-existing dev servers, browser sessions, Docker services, and user
  data untouched. Stop only processes and browser sessions started by this audit.

## Preflight

Record in the report:

- branch, HEAD SHA, dirty/clean state, and whether unrelated changes exist;
- exact application URL and target category: disposable local, shared demo, or
  other;
- Web/API health and database migration status;
- whether the full fictional seed and role credentials are present;
- browser engine, viewport(s), date/timezone, and tested commit;
- any blocker that prevents a real journey.

Do not print or record the full database hostname, credentials, tokens, or
cookies. If the application is not running, use the repository's documented
commands and safe local configuration. Do not silently switch to mocks.

If the connected target lacks required seed data or migration state, report it
as a blocker and continue every read-only or unaffected test that remains valid.

## Browser Working Method

Use the attached Browser capability for the UI. For each material state change:

1. inspect the current page and interactive elements;
2. perform one deliberate action;
3. wait for navigation or network completion;
4. inspect the new page again instead of reusing stale element references;
5. capture visible text, URL, network/API result, console/page errors, and a
   screenshot when useful;
6. cross-check surprising behavior against the current API/code before calling
   it a defect.

Prefer semantic labels and roles. If the browser's native click reports success
without dispatching the application handler, verify whether the page changed;
use a safe DOM click fallback only when necessary and record the tool quirk
separately from product findings.

Test at minimum:

- desktop: approximately 1440 × 900;
- laptop: approximately 1280 × 800;
- narrow/mobile usability: approximately 390 × 844 for login, navigation, the
  main dashboard, one operational table/form, and the student portal.

Capture screenshots only after the page reaches a stable state. Clear stale
browser error history before each journey, then distinguish new application
errors from browser-tool or local-origin configuration errors.

## Required Role Coverage

Use the fictional identities from
`docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md`. Cover:

| Role/scenario | Required browser evidence |
| --- | --- |
| `PLATFORM_ADMIN` | Correct platform scope; no accidental tenant authority |
| `INSTITUTION_ADMIN` | Northstar setup, masters, people, exam overview, reports/audit |
| `EXAM_CONTROLLER` | Cedar registration, schedule, conduct oversight, results/publication |
| `DEPARTMENT_ADMIN` | Only named department data and allowed review/report actions |
| `FACULTY` | Only assigned subjects; marks entry and submission boundaries |
| `INVIGILATOR` | Only assigned sittings; duty and attendance boundaries |
| `AUDITOR` | Read-only visibility and scoped reports/audit |
| `STUDENT — PASS` | Own registration, timetable, result, admit card, grade card |
| `STUDENT — ABSENT` | ABSENT shown as a state, never numeric zero |
| `STUDENT — WITHHELD` | No numeric/component leakage and no grade card |
| Multi-role user | Server-authorized role switch and navigation remount |
| Suspended/inactive user | Expected login or live-authority denial |

For authorization negatives, use known fictional foreign IDs only when already
available from the test fixtures. Do not probe unrelated user or tenant data.

## Required End-to-End Journeys

### 1. Authentication and context

- login, incorrect login, refresh/reload, logout, and post-logout denial;
- institution and role switching where available;
- active-role navigation and direct-route denial;
- suspended/inactive account behavior;
- no access/refresh token exposure in URL, page text, storage, logs, or reports.

### 2. Northstar College journey

Verify the college application/submission path through:

```text
institution context
→ academic masters
→ students / faculty / enrolments
→ exam and registration/application
→ eligibility and independent approval
→ timetable / halls / deterministic seats
→ invigilator duty
→ attendance / incidents
→ assigned examiner marks
→ submission and different-person approval
→ result computation
→ publication
→ student result / grade card
→ reports / audit
```

Use the completed Northstar historical exam for read-only outcome evidence.
Do not republish or alter its current result merely to prove the screen.

### 3. Cedar School journey

Verify the school auto-enrol path through the same operational stages. Use the
completed Cedar historical exam to confirm PASS, ABSENT, and WITHHELD behavior.
Preserve the upcoming `ANNUAL-2026` fixture unless a disposable isolated target
is explicitly available for write-path tests.

### 4. Validation and conflict behavior

Verify, through safe UI actions or existing focused evidence where UI mutation
would be unsafe:

- duplicate/invalid import feedback and atomicity;
- registration-window, inactivity, and eligibility denials;
- hall capacity, student overlap, hall overlap, and invigilator overlap;
- incomplete attendance blocking and explicit ABSENT;
- incident hold producing WITHHELD;
- out-of-range marks, stale version, unassigned faculty, and self-approval denial;
- stale result-run denial, idempotent publication, withdrawal visibility, and
  exactly one current publication;
- private document authorization and unavailable-document states;
- tenant, department, assigned-resource, and own-student boundaries;
- formula-safe and role-scoped CSV exports;
- audit entries only for real successful post-migration commands.

### 5. UX and visual quality

Inspect:

- journey-aligned navigation, active state, breadcrumbs, role terminology;
- loading, empty, success, validation, forbidden, stale, and server-error states;
- form labels, defaults, destructive-action clarity, and disabled/busy behavior;
- tables at desktop and narrow widths, overflow, truncation, and readability;
- keyboard focus, obvious accessible names, modal focus/escape, contrast, and
  touch-target usability;
- date/timezone presentation, counts, statuses, revision/version language;
- page refresh/deep link behavior;
- console errors, failed requests, accidental duplicate requests, and visible
  Vite/runtime overlays;
- consistency with `docs/design/index.html` without treating the mockup as more
  authoritative than accepted business behavior.

## Finding Classification

Use stable IDs:

```text
BUG-001, BUG-002, ...
ENH-001, ENH-002, ...
BLOCKER-001, ...
```

Severity:

| Severity | Meaning |
| --- | --- |
| P0 | Tenant/security/privacy/data-corruption or unrecoverable workflow failure |
| P1 | Tuesday-demo blocker or broken core examination rule |
| P2 | Significant workflow, reliability, validation, or accessibility defect |
| P3 | Minor defect or polish problem with a concrete expected behavior |

Classify as:

- **Bug** only when current behavior conflicts with repository acceptance,
  contracts, decisions, documented workflow, or an objectively broken UI/API;
- **Enhancement** when current behavior is valid but a concrete improvement has
  user value;
- **Blocker / not tested** when evidence cannot establish behavior;
- **Deferred hardening** for production-only concerns outside the demo path.

Do not turn personal design preference into a bug. Deduplicate symptoms that
share one root cause and list all affected journeys under that finding.

## Findings Report Format

Write `docs/codex/reviews/FULL-APPLICATION-browser-audit-YYYY-MM-DD.md` with:

```text
# Full Application Browser Audit — YYYY-MM-DD

## Executive Summary
## Tested Target and Commit
## Preflight and Data State
## Journey Coverage Matrix
## Role / Authorization Matrix
## Acceptance Coverage (A01-A15: PASS / FAIL / BLOCKED / NOT TESTED)
## Confirmed Bugs
## Recommended Enhancements
## Deferred Hardening
## Blockers and Untested Areas
## Evidence Index
## Data Mutations and Cleanup
## Suggested Remediation Order
```

Every detailed bug must include:

- ID, severity, concise title, affected role/tenant/journey;
- expected behavior and source of expectation;
- actual behavior;
- minimal numbered reproduction steps;
- observed UI, URL, API status/error/request ID, console evidence, and screenshot;
- current-code verification and likely root cause, or `ROOT CAUSE NOT CONFIRMED`;
- tenant/security/data risk;
- smallest reasonable fix boundary;
- focused acceptance/verification needed;
- duplicate/related finding IDs.

Every enhancement must include:

- ID, title, affected users and workflow;
- observed friction and evidence;
- proposed behavior and demo/user value;
- estimated effort (`S`, `M`, or `L`) and risk;
- dependencies, schema/contract impact, and whether product approval is needed;
- measurable acceptance outcome.

Use direct repository file links or relative paths and curated screenshot names.
Never paste full sensitive response bodies or credentials.

## Audit Handoff Format

Write `docs/codex/handoffs/browser-audit/SESSION-HANDOFF.md` so a fresh session
can resume without chat history. Include:

- audit date, branch, base SHA, final HEAD, target category and safe URL label;
- whether the working tree was changed only by audit artifacts;
- exact roles and journeys completed;
- exact PASS/FAIL/BLOCKED/NOT TESTED totals;
- finding IDs by severity and enhancement priority;
- evidence directory and report path;
- commands/tests run and their actual outcomes;
- test-data mutations, cleanup completed, and anything intentionally retained;
- browser/tool/environment issues separated from product bugs;
- schema, contract, migration, environment, and cross-lane impact;
- remaining blockers and the next exact action;
- the minimal files the remediation session must read.

Remove stale statements from an existing browser-audit handoff rather than
appending contradictory history.

## Cumulative Remediation Prompt Pack

After the findings report is complete, generate
`docs/codex/generated/POST-BROWSER-AUDIT-remediation-prompts.md` from confirmed
findings only.

### Optimization Rules

- Generate **two to four implementation prompts total**, not one prompt per bug
  or enhancement.
- Group findings that share the same root cause, module, contract, migration,
  role boundary, test fixture, or verification journey.
- Order prompts by dependency: security/data correctness, core workflow/demo
  blockers, secondary reliability/UX, then approved enhancements.
- Keep a P0/security/schema change separate when combining it would obscure
  review or lock ownership.
- Do not mix speculative enhancements into a mandatory bug-fix prompt.
- Do not duplicate one finding across prompts. Add a coverage table mapping every
  included finding ID to exactly one prompt.
- Exclude BLOCKED/NOT TESTED claims from implementation scope; instead add a
  short discovery prerequisite where necessary.
- If there are no confirmed bugs, do not invent a bug-fix prompt. Generate only
  the justified enhancement or verification prompt.
- Prefer one complete vertical slice over several file-by-file tasks.

Recommended structure, adjusted to actual evidence:

```text
Prompt 1 — Security, Tenant Scope & Data Correctness
Prompt 2 — Core Examination Journey Reliability & Demo Blockers
Prompt 3 — UX, Accessibility & Operational Clarity Enhancements
Prompt 4 — Optional Deferred Hardening (only if justified and approved)
```

### Required Content in Every Generated Prompt

Each prompt must be ready to paste into a fresh Codex implementation session and
must include:

- objective and included finding IDs;
- verified evidence and exact reproduction summary;
- repository context to read, including the audit report and handoff;
- current modules/files likely involved;
- desired behavior and explicit non-goals;
- tenant, role, privacy, ABSENT/WITHHELD, approval, and publication rules that
  must remain intact;
- schema/migration, shared-contract, decision, and cross-lane impact;
- lock requirements and blockers;
- smallest complete UI → API → database slice when persistence is involved;
- focused tests and exact browser journeys required;
- completion-report and shared-context update requirements;
- instruction to verify each finding against current code, fix only still-valid
  findings, and record skipped findings with evidence;
- instruction not to commit, push, merge, deploy, or mutate a shared target
  unless explicitly requested.

For enhancement prompts, label product choices that require approval. Do not let
an implementation agent invent requirements merely because the audit suggested
an idea.

The remediation prompt file must begin with:

```text
# Post-Browser-Audit Cumulative Remediation Prompts

Source audit: ...
Tested commit: ...
Generated: ...

## Finding-to-Prompt Coverage
```

Then provide each full prompt inside its own copy-ready fenced block. End with a
recommended execution order, parallelization constraints, shared-lock notes,
and the verification gate after all prompts merge.

## Completion Gate

Do not finish the audit session until:

- both institution journeys and required roles were tested or explicitly marked
  BLOCKED with evidence;
- browser, API/network, console, authorization, and responsive checks were
  performed;
- findings were verified against current repository behavior and deduplicated;
- the report, screenshot evidence index, handoff, and cumulative remediation
  prompt pack exist as Markdown files;
- every confirmed finding maps to exactly one cumulative prompt;
- no secrets or non-fictional personal data appear in artifacts;
- `git diff --check` passes for audit-created text artifacts;
- final `git status` and artifact paths are reported accurately.

Return a concise final response with:

```text
Audit result:
- PASS / FINDINGS / BLOCKED

Artifacts:
- report
- handoff
- remediation prompt pack
- evidence directory

Coverage:
- roles and journeys completed
- bug totals by severity
- enhancement total
- blocked/not-tested total

Important next action:
- first cumulative prompt to run, or the blocker to resolve
```

Do not claim the application is fully tested when any required role or journey
is BLOCKED or NOT TESTED.
