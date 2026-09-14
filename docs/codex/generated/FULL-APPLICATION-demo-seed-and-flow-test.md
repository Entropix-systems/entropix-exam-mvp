# Full Application — Demo Seed, Role Credentials & End-to-End Flow Test

## Objective

Before starting B05, make the entire implemented Examination ERP reproducible
from fictional seed data and prove the complete application journey across IAM,
both institution types, academics, people, registration, scheduling, conduct,
evaluation, results, and student documents.

This is not a B04-only seed. It is the authoritative full-application demo-data
and role-access gate for all implemented A01-A05 and B01-B04 behavior, and it must
leave B05 with credible non-empty data for overview counts, readiness, audit
dependencies, and exports.

## Required Context

Read only:

1. `AGENTS.md`
2. `docs/codex/CONTEXT.md`
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/CONTRACTS.md`
5. `docs/codex/DECISIONS.md`
6. `docs/codex/ACCEPTANCE.md`
7. `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md`
8. this prompt
9. existing seed scripts under `packages/db/scripts/`
10. current IAM, Academics, People, Exams, Scheduling, Conduct, Evaluation,
    Results, Documents, Storage, Notifications, and Worker entry points

Repository state is authoritative. B04 is merged locally at `536fac9`; refresh
from the latest `integration` before creating a short-lived task branch.

## Required Commands and Artifacts

Implement:

- `pnpm seed:demo:full-application` — guarded, idempotent fictional seed
- `pnpm smoke:demo:full-application` — read-only structural/business assertions
- `pnpm test:demo:roles` — authenticated role and scope matrix
- `pnpm test:demo:journey` — focused school and college end-to-end journeys
- `docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md` — tracked, shared test credentials

Populate the tracked credential artifact only with intentionally public,
fictional `example.test` demo identities. Replace a `PENDING` account only after
the seed has provisioned it through the real authentication path and the role
test has verified that exact credential. Commit the populated artifact so every
developer has the same test reference. Never place tokens, hashes, connection
strings, cookies, or credentials for real/non-demo identities in it.

## Whole-Application Seed Coverage

### D0 and IAM

- Northstar College and Cedar School remain isolated ACTIVE tenants.
- Seed a usable account for every canonical role:
  `PLATFORM_ADMIN`, `INSTITUTION_ADMIN`, `EXAM_CONTROLLER`,
  `DEPARTMENT_ADMIN`, `FACULTY`, `INVIGILATOR`, `STUDENT`, and `AUDITOR`.
- Department-admin and faculty grants must carry real department scope.
- Include one multi-role user so context switching can be tested without
  accepting institution/role scope from the client.
- Include one inactive/suspended account that is expected to fail login or live
  authority recheck.
- Provision passwords through the real invitation/reset/password-hashing path.
  Never insert a plaintext password or a fake password hash.
- Keep refresh rotation, logout, cross-context denial, and session revocation
  testable. Do not print tokens, hashes, or connection strings to stdout.

### Academics and People

- Both tenants have campuses, departments, programmes, academic years, terms,
  cohorts, subjects, students, faculty, enrolments, and role-linked memberships.
- Preserve the fictional import cases for duplicate roll number, unknown subject,
  inactive student, invalid row, and successful preview/commit.
- Northstar models the college application path; Cedar models school auto-enrol.

### Exams and Registration

- Preserve Cedar `ANNUAL-2026`, its 15-17 September 2026 schedule, seats,
  schedule revision, and upcoming admit-card behavior unchanged.
- Add clearly named historical exams with fixed dates before 14 September 2026
  for completed school and college journeys. Never publish a result for a future
  sitting.
- Cover registration-open/closed states, eligibility, school auto-enrolment,
  college application/submission, approval, rejection, and an inactive-student
  denial fixture.

### Scheduling, Halls and Seats

- Historical exams have complete paper schedules, deterministic hall allocation,
  and exactly one seat per approved registration subject.
- Preserve reusable invalid scenarios for hall over-capacity, student overlap,
  hall overlap, and faculty-duty overlap without persisting an invalid final
  state.
- A schedule revision change invalidates the prior admit-card issue identity and
  republishing yields the current one.

### Duties, Attendance and Incidents

- Every completed historical sitting has an assigned and accepted invigilator.
- Submit attendance containing PRESENT, LATE, and ABSENT; no submitted batch may
  contain NOT_MARKED.
- Include a STUDENT incident resolved as `RETAIN_WITHHELD` and a HALL incident
  resolved with no result impact.
- Preserve controller reopen/correction behavior without modifying published
  result inputs before withdrawal.

### Marks and Independent Review

- Every historical exam subject has a department-valid assigned examiner.
- Save all configured mark components for attending students and leave required
  final/external marks blank for ABSENT students.
- Submit marks as the assigned FACULTY membership and approve them as a different
  authorized controller/department administrator membership.
- Preserve proof that unassigned editing and self-approval are denied.

### Results, Publication and Student Documents

- Compute immutable result runs only after submitted conduct and independently
  approved marks.
- Publish exactly one current version per historical exam; unchanged reruns must
  not withdraw, recreate, or increment it.
- Provide deterministic student outcomes:
  - Cedar Student 01 — `ABSENT`, never numeric zero
  - Cedar Student 02 — `WITHHELD`, no numeric/component detail or grade card
  - Cedar Student 03 — `PASS`, published result and printable grade card
  - at least one Northstar `PASS` and one `FAIL` when the roster supports it
- Student portal reads must resolve from the authenticated membership only and
  expose only the caller's approved registration, current timetable/seat,
  current publication, and eligible current document metadata.
- Admit and grade cards remain private version-bound printable HTML; do not create
  public document URLs.

### Supporting Runtime

- Verify Web, API, and Worker health endpoints using the seeded environment.
- Reuse the existing private-storage, scanner, signed-URL, and notification smoke
  foundations; do not create public documents or treat email as business state.
- Do not fabricate audit rows. If existing commands do not emit persistent audit
  events, record the exact B05 dependency instead of inventing history here.

## Role Credential Matrix

The generated credential Markdown must include at least:

| Credential scenario | Required role/context |
| --- | --- |
| Platform administration | `PLATFORM_ADMIN` |
| Northstar tenant administration | `INSTITUTION_ADMIN` |
| Cedar tenant administration | `INSTITUTION_ADMIN` |
| Exam configuration/publication | `EXAM_CONTROLLER` |
| Department-scoped review | `DEPARTMENT_ADMIN` with named department |
| Assigned marks entry | `FACULTY` with named subject/department |
| Assigned conduct | `INVIGILATOR` with named sitting |
| Read-only institution access | `AUDITOR` |
| Normal student result | `STUDENT` — PASS and grade-card eligible |
| Absent student result | `STUDENT` — ABSENT |
| Held student result | `STUDENT` — WITHHELD and no grade card |
| Context switch | one user with two legitimate role contexts |
| Negative login/authority | suspended/inactive account; expected denial |

For every usable account record email, password, institution, active role,
department/subject/sitting scope where relevant, expected landing route, fixture
scenario, and expected result. Clearly label negative credentials as expected to
fail. Do not place database URLs, access/refresh/reset/invitation tokens, hashes,
or non-fictional secrets in the file.

Passwords must be deterministic, intentionally public fictional test values used
only by `example.test` demo identities. Provision them through the real auth
workflow; do not insert plaintext passwords or hashes directly in the database.
Rerunning the seed must preserve the declared credentials. An intentional
rotation must update the database and tracked credential artifact atomically in
the same change and re-run every affected login assertion.

## Implementation Rules

- Keep `pnpm seed:demo` idempotent. The full-application command may call it and
  then add the historical journeys and role credentials.
- Drive workflow transitions through existing application services/repositories
  and concurrency/business checks. Do not use raw SQL or direct terminal-state
  updates to mark registration approved, schedules published, duties accepted,
  attendance submitted, marks approved, or results published.
- Replay historical actions through injectable application clocks using
  deterministic timestamps inside configured windows; never disable or widen
  conduct-window validation.
- Use restricted runtime access and `withTenant()` for tenant-owned persistence.
- Do not weaken tenant scope, known-foreign-ID denial, capacity/conflict checks,
  independent approval, result revision checks, ABSENT, WITHHELD, or publication
  visibility.
- Do not add speculative entities or rebuild D0 infrastructure.

## Safety and Targeting

- Default to disposable local PostgreSQL and refuse `NODE_ENV=production`.
- Refuse any credential identity outside `example.test` and abort if a matching
  account contains non-fictional or operator-owned data.
- Require explicit acknowledgement and exact target name before mutating a shared
  demo database.
- Print a safe preflight naming database category, tenant slugs, seed version,
  and exam codes. Never print connection strings, passwords, or tokens.
- Do not run the destructive `smoke:results-flow` against shared demo data.
- Make every rerun convergent: no duplicate users, grants, enrolments,
  registrations, papers, seats, duties, attendance, incidents, marks batches,
  runs, publications, or document references.
- Do not reset unrelated shared-demo users or overwrite operator-created data.

## End-to-End Role and Journey Tests

The role test must authenticate with every generated credential and prove:

1. Each role lands in the correct server-resolved scope.
2. Tenant and department boundaries deny known foreign IDs.
3. Students cannot read another student; faculty cannot edit an unassigned
   subject; invigilators cannot edit an unassigned sitting.
4. Marks submitters cannot approve their own batch.
5. Auditors remain read-only and platform users do not acquire tenant scope.
6. Suspended/inactive credentials fail as documented.
7. Logout/session revocation removes access.

The journey test must prove both paths through real API behavior and the key Web
screens:

```text
institution and role context
→ academics
→ students / faculty / enrolments
→ exam and registration
→ timetable / halls / seats
→ invigilator duty
→ attendance / incidents
→ examiner marks
→ independent approval
→ result computation
→ publication
→ student result / admit card / grade card
```

Run the seed twice and compare stable summarized IDs, counts, versions, issue IDs,
and publication identities. Perform a real Cedar Student 03 browser journey with
login, reload, portal, published result, one-page grade-card print, logout, and no
browser/Vite errors. Perform a focused Northstar college browser/API journey and
role-switch/tenant-isolation checks.

After the automated role and journey gates pass, use the Codex Browser/computer-
use plugin against the seeded application and commit a curated 6-8 screenshot
evidence set under `docs/codex/evidence/full-application-demo/`. Cover
representative controller, faculty, invigilator, and student screens, including
timetable/hall allocation, attendance, marks/independent approval, result
publication, PASS grade card, and WITHHELD privacy. Use the API role matrix for
exhaustive authorization coverage; do not duplicate every role/scope permutation
in the browser. Capture only stable post-action states, use descriptive
filenames, add a short evidence index, and ensure screenshots contain no
passwords, tokens, cookies, or developer tooling.

## Read-Only Full-Application Assertions

`pnpm smoke:demo:full-application` must verify at minimum:

- both tenant graphs and all canonical role credentials exist as declared
- academic relationships and memberships remain tenant-consistent
- school/college registration paths and negative fixtures are present
- every completed roster has exact schedule/seat coverage
- completed sittings have accepted duty and submitted non-NOT_MARKED attendance
- incident dispositions drive WITHHELD correctly
- approved marks have an independent reviewer
- computed snapshots match current input/rule revisions
- exactly one current publication exists per completed historical exam
- PASS/FAIL/ABSENT/WITHHELD privacy and grade-card eligibility are correct
- Student 03 `/api/v1/me/student-portal` is complete
- Cedar `ANNUAL-2026` upcoming timetable/admit identity remains unchanged
- missing context, cross-tenant IDs, and cross-student reads are denied

## Schema and Contract Impact

Expected schema/migration impact: **NONE**.

Expected shared-contract impact: **NONE**. If either is genuinely required, stop,
inspect `CURRENT-STATE.md`, acquire the applicable lock, and record cross-lane
impact before editing.

## Verification

Run only the meaningful gate:

- full-application seed on disposable local PostgreSQL — PASS
- identical second seed run — PASS with stable summary
- generated role credential artifact matches live login behavior — PASS
- read-only full-application smoke — PASS
- authenticated role matrix — PASS
- school and college journey tests — PASS
- representative browser journeys and curated screenshot evidence — PASS
- `pnpm verify:b04` — PASS
- relevant API/DB/Web typecheck or build — PASS
- one real Student 03 grade-card browser/print check — PASS

Run broad verification only if preparing the final integration gate or shared
foundation changed.

## Completion and Handoff

Update:

- `README.md` with safe local/shared-demo seed, role-test, journey-test, and
  credential-artifact commands
- `docs/codex/CURRENT-STATE.md` with exact counts/outcomes and whether local and
  shared demo application actually succeeded
- `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md` with commands, verification,
  credential artifact path, limitations, and B05 start action
- `docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md` with verified working
  role/scenario credentials, committed for all developers

Report attempted commands separately from successful execution. Do not claim the
dataset or credentials are applied to shared demo until the guarded shared-target
command and live role/smoke checks succeed.

The task is complete when a clean setup can reproduce and verify the entire
implemented application, every canonical role has a documented usable test
identity, Cedar and Northstar journeys pass, Student 03 has a real published grade
card, the future Annual admit-card fixture remains intact, and B05 can consume
authoritative non-empty data.
