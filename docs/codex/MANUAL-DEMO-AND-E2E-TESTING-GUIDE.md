# Examination ERP — Manual Demo and End-to-End Testing Guide

This is the practical start-to-finish runbook for demonstrating and manually testing the Examination ERP in a browser.

It covers:

- how to prepare the local environment;
- which demo credentials to use for each role;
- the recommended order for the demo;
- how to show both Northstar College and Cedar School journeys;
- how to create an institution, academic setup, students, exam, schedule, duties, marks, and results;
- which workflows are already seeded and which should be created manually;
- what can be mocked safely;
- what each step should prove; and
- the negative and authorization checks that should not be skipped.

The guide assumes the current verified release state. The canonical browser routes are `/platform`, `/masters`, `/schedule`, `/attendance`, `/marks`, `/results`, and `/student`.

## 1. Choose the demo mode

Use one of these modes before starting.

### Mode A — Fast seeded demo (recommended for presentations)

Use the existing fictional `full-application-v1` dataset. This is the fastest way to demonstrate the complete application because the workflow has already reached approved, published, and student-visible states.

Use this mode when you want to show the complete product in 30–60 minutes:

- Platform Admin access and institution switching
- Northstar College administration
- Cedar School controller workflow
- Timetable and hall allocation
- Duties and attendance
- Marks and independent approval
- Published PASS, FAIL, ABSENT, and WITHHELD outcomes
- Student admit card and grade card
- Auditor read-only access

Most completed historical records are intentionally read-only because they are already approved or published. This is expected.

### Mode B — Full manual build from an empty disposable database

Use this mode when you want to demonstrate the actual creation and mutation workflow: onboarding, masters, import, exam creation, registration, scheduling, attendance, marks, approval, computation, and publication.

Use a disposable local database only. Plan 2–4 hours for a careful run. Do not use the shared demo database for this flow.

The creation order is:

```text
Platform Admin
→ onboard institution
→ Institution Admin
→ academic masters
→ students, faculty, enrolments
→ Exam Controller
→ exam and registration
→ timetable, halls, seats
→ Invigilator
→ duty, attendance, incidents
→ Faculty / Examiner
→ marks entry and submission
→ Department Admin or Exam Controller
→ independent approval
→ Exam Controller
→ compute, review, publish
→ Student
→ result, admit card, grade card
```

## 2. Local environment preparation

### Prerequisites

- Node.js `24.20.0`
- pnpm `12.3.4` through Corepack
- Docker Desktop with Compose
- A browser with a clean profile or an incognito window
- Repository access

### First-time setup

From the repository root:

```bash
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
cp .env.docker.example .env.docker
```

Set the local values in `.env` and `.env.docker` as described in the repository README. Never commit either file.

Start the local database and apply migrations:

```bash
pnpm infra:up
pnpm setup:local
```

Load the complete manual-demo dataset:

```bash
pnpm seed:demo:full-application
```

Start the web app, API, and worker:

```bash
pnpm dev
```

Open:

- Web application: [http://localhost:5173](http://localhost:5173)
- API base: `http://localhost:3000/api/v1`
- Worker: port `3001`

### Verify before opening the browser

Run the read-only gates:

```bash
pnpm db:migrate:status
pnpm smoke:demo:full-application
pnpm test:demo:roles
pnpm test:demo:journey
pnpm test:demo:bulk-imports
```

Expected results:

- migrations are current;
- Northstar and Cedar historical publications exist;
- the role matrix passes with one expected suspended-user denial;
- PASS, ABSENT, and WITHHELD student journeys pass; and
- bulk-import preview/commit/replay checks pass.

If the seeded database is already prepared and unchanged, do not reseed just before a presentation. Reseeding is idempotent, but it can reset the state you planned to demonstrate.

## 3. Safety rules for the demo

- Use only the fictional `example.test` credentials in this guide.
- Use a disposable local database for any create, edit, submit, approve, publish, withdraw, import, or reset operation.
- Do not run `pnpm smoke:results-flow` against a shared or production database; it mutates result publications.
- Do not expose `.env`, database URLs, browser cookies, access tokens, refresh tokens, or reset tokens during screen sharing.
- Use one browser context per user. Log out fully before changing accounts, or use separate incognito windows.
- Do not use a completed historical exam for mutation demonstrations. Its approved/published state is intentionally locked.
- Use a new past-dated demo exam in Mode B for mutation demonstrations. Do not publish a result for a future sitting.
- When Platform Admin enters an institution, confirm the selected institution name is visible before showing or changing data.

## 4. Demo credentials

All credentials below use the intentionally public fictional password:

```text
DemoOnly!2026
```

These credentials are for the disposable local demo only.

### Platform and institution users

| Demo purpose | Login | Expected landing | Use it to demonstrate |
| --- | --- | --- | --- |
| Platform administration | `platform.admin@demo.example.test` | `/platform` | Institution list, onboarding, institution switcher, entering an institution, returning to platform mode. |
| Northstar administration | `institution.admin@northstar.example.test` | `/masters` | Northstar setup, academics, students, registration, schedule, reports, and tenant-scoped operations. |
| Cedar administration | `institution.admin@cedar.example.test` | `/masters` | Cedar setup, school-style auto-enrolment, students, and institution administration. |
| Exam configuration/publication | `exam.controller@cedar.example.test` | `/results` | Cedar exam selection, timetable/result readiness, computation, publication, withdrawal, and current result visibility. |
| Department review | `department.admin@northstar.example.test` | `/marks` | Department-scoped marks review and independent approval. |
| Assigned marks entry | `ananya.iyer@northstar.example.test` | `/marks` | Assigned subject roster, component marks, save/submit behavior, and read-only approved marks. |
| Assigned conduct and marks | `nisha.rao@cedar.example.test` | `/marks` by default | Faculty marks plus context switch to Invigilator and assigned attendance. |
| Read-only institution access | `auditor@northstar.example.test` | `/` | Read-only reports, audits, and institution data without mutation authority. |
| Context switch | `context.switch@northstar.example.test` | `/results` | Switching between legitimate Exam Controller and Auditor contexts. |

### Student users

| Demo purpose | Login | Expected landing | Expected result |
| --- | --- | --- | --- |
| Cedar PASS student | `student.03@cedar.example.test` | `/student` | PASS, 75%, GPA 8; admit card and grade card available. |
| Cedar ABSENT student | `student.01@cedar.example.test` | `/student` | ABSENT; subject percentage/grade is nonnumeric; grade card labels absence. |
| Cedar WITHHELD student | `student.02@cedar.example.test` | `/student` | Hold message only; no marks, percentage, GPA, or grade card. |
| Northstar PASS student | `student.001@northstar.example.test` | `/student` | Published Northstar PASS result and current documents. |

### Negative credential

| Scenario | Login | Expected behavior |
| --- | --- | --- |
| Suspended account | `suspended@cedar.example.test` | Login is denied with a generic invalid-credentials message. |

## 5. Seeded data map

### Northstar College

Northstar represents the college application path:

- historical exam: `NORTHSTAR-HIST-2026`;
- 3 subjects, 2 approved student registrations;
- 3/3 papers scheduled and 6/6 subject seats allocated;
- 3/3 marks batches independently approved;
- one PASS student at 75% / GPA 8.00;
- one FAIL student at 30% / GPA 0.00;
- computed input revision 14; and
- publication v1 visible to students.

Northstar also has a current `SEM3-2026` registration-open scenario for showing an incomplete/current workflow.

### Cedar School

Cedar represents the school auto-enrolment path:

- current future exam: `ANNUAL-2026`, scheduled for 15–17 September 2026;
- historical exam: `CEDAR-HIST-2026`;
- 20 approved registrations;
- 3/3 papers and 60/60 seats allocated;
- 3/3 marks batches approved;
- publication v1;
- 18 PASS students;
- 1 ABSENT student;
- 1 WITHHELD student; and
- one active hold caused by the retained incident disposition.

The seeded historical records are ideal for the final result and student-portal demonstration. The current annual exam is ideal for showing an upcoming timetable and non-published state.

## 6. Recommended fast demo — 45 to 60 minutes

Follow this order during a presentation. It gives the audience the complete story without repeatedly mutating the same data.

### Step 1 — Platform Admin: start in platform mode

Login: `platform.admin@demo.example.test`

Expected route: `/platform`

Show:

1. The platform landing page.
2. The institution list and institution status.
3. The “Onboard institution” action and its fields without submitting, unless you intentionally want to create a disposable third institution.
4. The institution switcher in the sidebar.

Expected proof: Platform Admin has global platform access but no institution context until an institution is selected.

### Step 2 — Platform Admin: enter Northstar

From the sidebar institution switcher:

1. Select Northstar College.
2. Confirm the selected institution is visible in the sidebar/header.
3. Open the institution overview.
4. Open the academic, student, exam, schedule, attendance, marks, result, and reports sections as needed.
5. Return to `/platform` using the platform-mode action.

Expected proof: Platform Admin can enter an institution using explicit context and return to platform administration. The user remains a Platform Admin; the app must not silently impersonate an Institution Admin.

### Step 3 — Institution Admin: show setup and tenant scoping

Logout, then login:

```text
institution.admin@northstar.example.test
```

Expected route: `/masters`

Open:

1. **Setup & access** — show the institution name and role-scoped access.
2. **Academic masters** — show campus, department, program, academic year, term, cohort, and subjects.
3. **Students** — show the Northstar directory and inactive-student state.
4. **Exams & registration** — show the current registration-open exam and historical completed exam.

Expected proof: Institution Admin sees only Northstar data and has tenant-scoped administration.

### Step 4 — Exam Controller: show the Cedar current timetable

Logout, then login:

```text
exam.controller@cedar.example.test
```

Open the exam selector and choose `ANNUAL-2026`.

Open **Timetable & halls** and show:

- 15–17 September 2026 sittings;
- halls and capacities;
- schedule revision;
- seat allocation; and
- the upcoming/non-published state.

Expected proof: Future operational data is separate from the completed historical result and remains available for exam administration.

### Step 5 — Exam Controller: show the Cedar completed result

Select `CEDAR-HIST-2026`.

Open **Result publication** or **Results** and show:

- 20 students;
- 3/3 approved subjects;
- 60 subject outcomes;
- publication v1;
- one active hold; and
- readiness status.

Then open the result register and point out:

- PASS: 18;
- FAIL: 0;
- ABSENT: 1; and
- WITHHELD: 1.

Expected proof: The controller can see the persisted computed/published result and the outcome states are distinct.

### Step 6 — Faculty: show assigned marks and independent approval

Logout, then login:

```text
ananya.iyer@northstar.example.test
```

Open **Marks & review** and select `NORTHSTAR-HIST-2026` / `CS301 · Data Structures`.

Show:

- the assigned examiner scope;
- component marks;
- approved/locked status; and
- that approved values are not editable.

Then logout and login as:

```text
department.admin@northstar.example.test
```

Open the same subject and show the independent review/approval view.

Expected proof: Marks are entered by the assigned Faculty member and approved by a different authorized reviewer. Self-approval is not permitted.

### Step 7 — Invigilator: show duty and attendance

Logout, then login:

```text
nisha.rao@cedar.example.test
```

The default context is Faculty. Use the role/context selector to switch to **Invigilator**.

Open **Duties & attendance** or `/attendance`.

Show:

- only the assigned sitting;
- the accepted historical duty;
- the roster;
- PRESENT, LATE, and ABSENT attendance states; and
- the submitted/read-only status.

Expected proof: The invigilator can only access assigned sittings, and submitted attendance cannot be casually edited.

### Step 8 — PASS student: show the complete student portal

Logout, then login:

```text
student.03@cedar.example.test
```

Open `/student` and show:

1. Approved registration.
2. Published timetable.
3. Hall and seat.
4. Admit card.
5. PASS result, 75%, and GPA 8.
6. One-page printable grade card.

Expected proof: A student sees only their own approved, current, published records and eligible documents.

### Step 9 — ABSENT student: show nonnumeric subject outcome

Logout, then login:

```text
student.01@cedar.example.test
```

Open the result and grade-card preview.

Show:

- outcome `ABSENT`;
- subject percentage/grade represented as not applicable rather than a numeric subject zero; and
- the grade card labels the absence.

The final result rule allows the aggregate GPA to include the absent credit with zero grade points. Do not describe that aggregate calculation as a subject mark of zero.

### Step 10 — WITHHELD student: show privacy boundary

Logout, then login:

```text
student.02@cedar.example.test
```

Open `/student`.

Expected display:

- hold/withheld message;
- no component marks;
- no percentage;
- no GPA; and
- no grade-card action.

Expected proof: WITHHELD is a privacy state, not a numeric result state.

### Step 11 — Auditor: show read-only access

Logout, then login:

```text
auditor@northstar.example.test
```

Open the overview, reports, and audit surfaces.

Attempt only safe UI inspection. Confirm that mutation controls are absent or disabled. Do not deliberately submit a mutation during the presentation.

Expected proof: Auditor has read-only tenant access.

### Step 12 — End the demo cleanly

1. Logout from the final account.
2. Navigate directly to `/results` or `/student`.
3. Confirm the application returns to `/login` or denies the request.
4. Close the browser window or clear the demo browser profile.

## 7. Full manual build from scratch

Use a fresh disposable database and follow this sequence when the audience needs to see record creation rather than only seeded completed states.

### 7.1 Platform Admin — onboard an institution

Login: `platform.admin@demo.example.test`

1. Open `/platform`.
2. Select **Onboard institution**.
3. Enter a fictional institution name, unique code, type, primary administrator, administrator email, and initial academic year.
4. Submit the form.
5. Confirm the new institution appears in the platform list.
6. Select the new institution in the sidebar switcher.
7. Confirm the institution context banner/header changes.

Use a third fictional institution such as `Riverside Demo Institute` for this test. Do not onboard over Northstar or Cedar.

Expected checks:

- required fields are validated;
- duplicate institution codes are rejected;
- the institution appears exactly once after a retry;
- the selected institution is used for later requests; and
- the Platform Admin’s real identity remains visible in audit records.

If the onboarding form creates an administrator invitation rather than an immediately usable password account, record the invitation flow as a mocked external-email step and continue with a pre-seeded Institution Admin for the rest of the presentation.

### 7.2 Institution Admin — create academic masters

Use the institution administrator created by onboarding, or the seeded Northstar/Cedar Institution Admin for a repeatable demo.

Open **Academic masters** and create the hierarchy in this order:

1. Campus
2. Department
3. Program
4. Academic year
5. Term
6. Cohort
7. Subjects

Confirm:

- codes are unique within the institution;
- term/program/year relationships are valid;
- dates are ordered;
- foreign institution IDs are rejected; and
- a reload shows persisted records.

### 7.3 Institution Admin — import students and faculty

Open **Students**.

For a positive import:

1. Choose the CSV import action.
2. Upload `fixtures/imports/bulk/northstar-students-upload.csv` for a Northstar-shaped dataset or `fixtures/imports/bulk/cedar-students-upload.csv` for Cedar.
3. Run preview.
4. Check row counts and validation messages.
5. Commit the valid import.
6. Reload the student directory.
7. Replay the same file and confirm no duplicates are created.

For a negative import:

1. Upload `fixtures/imports/bulk/student-import-reconciliation.csv` or `fixtures/imports/student-import-invalid.csv`.
2. Run preview.
3. Show row-numbered errors such as duplicate roll number, unknown subject, or invalid data.
4. Do not commit.
5. Confirm no partial invalid records were created.

The frozen import columns are:

```text
roll_no,name,email,cohort_code,subject_codes
```

### 7.4 Exam Controller — create the exam

Open **Exams & registration**.

Create a new past-dated exam for the manual workflow. Configure:

- exam name and code;
- institution;
- academic year and term;
- school or college registration mode;
- subjects;
- registration open and close times; and
- eligibility rules.

Use the school mode to demonstrate Cedar-style auto-enrolment. Use the college mode to demonstrate Northstar-style student application and controller approval.

Do not use a future exam for a published-result demo. The result engine must not publish a result for a future sitting.

### 7.5 Registration workflow

#### College application path — Northstar style

1. Open registration as the student or use the seeded Northstar registration flow.
2. Select only eligible enrolled subjects.
3. Save a draft.
4. Submit the application.
5. Login as the Exam Controller.
6. Approve one application.
7. Reject another application with a reason.
8. Login as the student and resubmit the rejected application if the test case requires it.

Expected checks:

- closed registration windows reject submission;
- inactive or ineligible students cannot submit;
- unknown subjects cannot be selected;
- approval stores reviewer and decision details; and
- replaying the same command does not create duplicate registrations.

#### School auto-enrolment path — Cedar style

1. Configure the exam as a school-mode exam.
2. Confirm eligible active students and subjects.
3. Run the auto-enrolment action.
4. Open the approved registration roster.
5. Confirm ineligible or inactive students are excluded.

Expected proof: Approved `RegistrationSubject` records form the roster used by scheduling.

### 7.6 Timetable, halls, and seats

Open **Timetable & halls**.

1. Create halls with capacities.
2. Add one paper/sitting per exam subject.
3. Set valid start and end times.
4. Run allocation preview.
5. Review capacity and conflict warnings.
6. Commit the allocation.
7. Publish the schedule revision.
8. Confirm every approved subject registration has exactly one deterministic seat.

Negative checks to demonstrate in a disposable run:

- hall over-capacity;
- overlapping student sittings;
- overlapping hall sittings;
- overlapping invigilator duties;
- invalid time range; and
- duplicate allocation.

Back-to-back half-open sittings should be accepted when one ends exactly as the next begins.

### 7.7 Duties, attendance, and incidents

Use the Invigilator context:

1. Assign an invigilator to the sitting.
2. Accept the duty as the assigned invigilator.
3. Open the conduct window.
4. Mark students PRESENT, LATE, or ABSENT.
5. Create a student incident for one student.
6. Submit attendance only after there are no `NOT_MARKED` rows.

Use the Exam Controller context to:

1. Review the submitted attendance.
2. Reopen attendance with a reason if correction is needed.
3. Resolve an incident as clear or retain the hold.
4. Confirm a retained student hold produces WITHHELD later.
5. Close a hall-wide incident with an explicit no-result-impact disposition when appropriate.

Expected checks:

- unassigned invigilators cannot access the roster;
- unresolved `NOT_MARKED` blocks submission;
- LATE counts as attended;
- ABSENT is not converted to numeric zero; and
- a retained hold blocks numeric result disclosure.

### 7.8 Marks entry and independent review

Use the assigned Faculty/Examiner account:

1. Open **Marks & review**.
2. Select the assigned exam subject.
3. Enter valid internal/external or final component marks.
4. Save the draft.
5. Reload and confirm persistence.
6. Submit the complete marks batch.

Use a different authorized reviewer:

1. Login as Department Admin or Exam Controller.
2. Open the submitted batch.
3. Review the component values and attendance state.
4. Approve the batch.

Optional return path:

1. Return the batch with a reason.
2. Login as the Faculty submitter.
3. Correct the marks.
4. Resubmit.
5. Approve with the independent reviewer.

Negative checks:

- out-of-range marks are rejected;
- incomplete marks are rejected;
- an unassigned Faculty member cannot edit;
- a submitter cannot approve their own batch; and
- stale versions are rejected instead of silently overwriting newer data.

For ABSENT students, required final/external marks should remain blank. Held students may retain drafts, but numeric results must remain hidden.

### 7.9 Compute and publish results

Use the Exam Controller account:

1. Open **Result publication** or `/results`.
2. Select the completed exam.
3. Confirm readiness blockers are clear:
   - conduct submitted;
   - all required marks independently approved;
   - no stale input revision; and
   - required schedule/result data present.
4. Start result computation.
5. Review the candidate run and summary counts.
6. Publish the selected current run.
7. Confirm exactly one current publication exists.
8. Open the student-facing result as a student.

Correction demonstration, disposable database only:

1. Withdraw the current publication with a reason.
2. Change and independently reapprove the affected input.
3. Compute a new run.
4. Publish the corrected version.
5. Confirm the old publication is no longer current and the new version is visible.

Do not recompute results at read time or expose candidate/withdrawn runs to students.

### 7.10 Student documents

Use the PASS student account:

1. Open `/student`.
2. Confirm only the authenticated student’s registration is visible.
3. Open the admit card.
4. Confirm schedule revision, issue identity, local times, hall, and seat.
5. Open the grade card.
6. Confirm the result is tied to the current publication.
7. Print or save the one-page output if demonstrating documents.

Repeat as the WITHHELD student and confirm no grade card or numeric marks are available.

## 8. Platform Admin demonstration in detail

The Platform Admin flow is separate from an Institution Admin flow.

### Platform mode

Use:

```text
platform.admin@demo.example.test
```

At `/platform`, show:

- all institutions the Platform Admin can administer;
- institution status and onboarding state;
- onboarding action;
- platform-level navigation; and
- no institution-specific data before selection.

### Institution mode

Select an institution from the existing sidebar dropdown. Then show:

- the selected institution label;
- institution overview and counts;
- institution-specific setup and workflow screens; and
- operations performed under Platform Admin authorization.

The Platform Admin should not be silently impersonated as an Institution Admin. The request should retain the Platform Admin identity while using explicit institution context.

### Return to platform mode

Use the platform switcher/action to return to `/platform`. Confirm:

- the institution-specific selection is cleared or clearly inactive;
- the platform list remains available; and
- a direct institution URL without valid context is denied or safely redirected.

## 9. Role-switch and authorization checks

### Multi-role context switch

Login: `context.switch@northstar.example.test`

1. Confirm the initial Exam Controller context.
2. Open the role/context selector.
3. Switch to Auditor.
4. Confirm the route changes to an Auditor-authorized destination when required.
5. Confirm the navigation changes.
6. Confirm controller-only mutation controls are unavailable.

### Faculty to Invigilator

Login: `nisha.rao@cedar.example.test`

1. Start in Faculty context.
2. Switch to Invigilator.
3. Confirm the app routes to `/attendance` instead of leaving the user on an unauthorized marks page.
4. Confirm only assigned sittings are visible.

### Direct-route denial

1. Login as a Faculty user.
2. Navigate directly to a controller-only route such as `/results`.
3. Confirm server-backed permission denial.
4. Do not treat hiding the sidebar item as sufficient authorization.

### Tenant isolation

1. Login as Northstar Institution Admin.
2. Confirm Cedar is not available in the normal institution membership context.
3. Attempting to use a known Cedar record ID must be denied by the API.
4. Repeat the same principle with a student attempting to access another student’s record.

## 10. What can be mocked and what must be real

### Safe to mock or pre-seed

These are suitable for seeded fixtures or a controlled demo dataset:

- institution records;
- academic masters;
- students, faculty, and enrolments;
- exam definitions and rule versions;
- historical registrations;
- historical schedule and seat allocation;
- accepted duties and submitted attendance;
- approved marks;
- computed result runs and current publications;
- fictional PASS, FAIL, ABSENT, and WITHHELD outcomes; and
- printable document metadata.

This is what Mode A uses. It is still real application data loaded into the local database; it is not browser API interception.

### Acceptable external-service mocks

- Email delivery may be represented by the invitation/reset state rather than sending real email.
- Private object storage may use the local private-object service supplied by the repository.
- Time-sensitive demonstrations may use seeded historical dates or the repository’s injectable application clock in a disposable test run.
- A presenter may use a pre-created onboarding administrator if the external invitation email is not configured.

### Do not mock for an end-to-end demo

Keep these real:

- login and logout;
- role resolution and institution context;
- tenant isolation;
- registration approval;
- schedule conflict and capacity checks;
- duty and attendance submission;
- marks assignment and independent approval;
- result computation and publication;
- student ownership checks;
- WITHHELD privacy; and
- route authorization.

Do not use frontend fixtures, intercepted API responses, hidden test buttons, direct database terminal-state updates, or fabricated tokens to make the demo pass.

## 11. Manual test checklist

Use this checklist while testing:

### Environment

- [ ] Local infrastructure is running.
- [ ] Web, API, and worker are running.
- [ ] Migration status is current.
- [ ] Full demo seed or fresh manual dataset is confirmed.
- [ ] Browser is using a clean context.

### Platform

- [ ] Platform Admin lands at `/platform`.
- [ ] Institution list is visible.
- [ ] Onboarding form validates required data.
- [ ] Institution switcher enters Northstar or Cedar.
- [ ] Platform Admin can return to platform mode.

### Institution setup

- [ ] Setup and access loads for the selected tenant.
- [ ] Academic masters reload after creation.
- [ ] Student directory is tenant-scoped.
- [ ] Valid import previews and commits.
- [ ] Invalid import shows row errors and does not partially commit.
- [ ] Replaying a committed import does not duplicate data.

### Exam and operations

- [ ] Exam can be created with school or college mode.
- [ ] Registration window and eligibility rules apply.
- [ ] Approved registrations form the schedule roster.
- [ ] Hall capacity and overlap checks work.
- [ ] Seat assignments persist.
- [ ] Duty assignment and acceptance work.
- [ ] Attendance cannot close with `NOT_MARKED` rows.
- [ ] Incident disposition affects result hold state.
- [ ] Assigned Faculty can enter and submit marks.
- [ ] Independent reviewer can approve.
- [ ] Self-approval is denied.
- [ ] Result run blocks until prerequisites are ready.
- [ ] Publication exposes the current result only.

### Student outcomes

- [ ] PASS student sees result, admit card, and grade card.
- [ ] FAIL remains distinct from ABSENT.
- [ ] ABSENT subject fields are nonnumeric/not applicable.
- [ ] WITHHELD shows only the hold state.
- [ ] Student cannot access another student’s data.

### Authorization and cleanup

- [ ] Auditor is read-only.
- [ ] Direct unauthorized routes are denied.
- [ ] Suspended login is denied generically.
- [ ] Logout revokes access to protected routes.
- [ ] No console errors appear during the run.
- [ ] No credentials, tokens, or database details were exposed on screen.

## 12. Troubleshooting

### The page is blank or the API is unavailable

Check that the three processes are running:

```bash
pnpm dev
```

Then verify the API and worker health endpoints or restart the local processes.

### The login works but expected data is missing

Confirm that the full-application seed ran, not only the base seed:

```bash
pnpm seed:demo:full-application
pnpm smoke:demo:full-application
```

### A completed exam is read-only

This is expected. Approved marks, submitted attendance, and published results are intentionally protected. Use Mode B with a new disposable past-dated exam to demonstrate mutation.

### A student cannot see a grade card

Check the outcome:

- PASS, FAIL, and ABSENT can have a grade card under the current rules;
- WITHHELD cannot have a grade card; and
- withdrawn or non-current publications are not student-visible.

### The wrong user’s data appears

Stop the demo immediately, logout, close the browser context, and verify the selected institution and account. Do not continue until tenant and student ownership are confirmed.

## 13. Evidence and release references

For screenshots and already-verified browser states, see:

- [Full-application demo evidence](evidence/full-application-demo/README.md)
- [Final release verification](FINAL-RELEASE-VERIFICATION.md)
- [Seeded role credentials](SEEDED-ROLE-TEST-CREDENTIALS.md)

For the implementation-level seed and automated verification details, see:

- [Full-application demo seed and flow test](generated/FULL-APPLICATION-demo-seed-and-flow-test.md)
- [Post-browser remediation prompts](generated/POST-BROWSER-AUDIT-remediation-prompts.md)

## 14. Clean shutdown

After a local demo:

```bash
pnpm dev:stop
pnpm infra:down
```

If you intentionally created a disposable test database, remove it using the project’s approved local cleanup procedure. Do not delete a shared database or use broad destructive commands.
