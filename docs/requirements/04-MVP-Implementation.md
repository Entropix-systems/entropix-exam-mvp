Examination ERP MVP Implementation

Three day delivery and release gates  
Entropix Systems | Product and engineering team

# 1 Delivery approach

Build the agreed M01–M10 scope as three daily vertical slices, each integrated into the same repository. The sprint ends with a release candidate and controlled pilot only if all required gates pass. A three-day calendar window does not establish production readiness.

## Team and prerequisites

The estimate assumes four experienced full-stack engineers for three eight-hour days, approximately 96 engineering hours, plus 24 hours of shared QA/product support. It also assumes reusable authentication and UI foundations, a prepared cloud account, working email sender, storage/scanner access and prompt business decisions. These are planning assumptions, not confirmed staffing or commitments.

| **Owner**              | **Responsibility**                                               | **Interfaces to agree first**                              |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| E1 Technical lead      | Tenant isolation, identity, database, integration and deployment | Tenant transaction wrapper, role contracts, migrations.    |
| E2 Academic engineer   | Setup, people/imports, exams and registration                    | Enrolment keys, registration states and rule schema.       |
| E3 Operations engineer | Timetable, halls, duties, attendance and documents               | Approved roster, paper/hall IDs and input revisions.       |
| E4 Results engineer    | Marks, approval, result engine and student outputs               | Attendance outcomes, batch approval and snapshot contract. |
| QA and product         | Fixtures, acceptance, business decisions and release evidence    | School/college examples and role-based test identities.    |

## Before the clock starts

Confirm the scope baseline and result fixture rules; provision two fictional tenants, role identities and database/storage; verify a fresh checkout can install and build; pin compatible dependencies; prepare the CI environment and email sender; agree the fixed import templates and API error contract.

If these prerequisites are not ready, record the delay separately. Do not count external account provisioning as completed engineering. Do not silently reduce tenant isolation, approval integrity, file protection or result accuracy to preserve the date.

## Integration discipline

Merge small reviewed changes through one integration branch; use additive migrations and a single migration owner. Contract types and IDs are shared before parallel feature development. Feature completion requires a working API, scoped UI, validation and a relevant test—not just a screen.

# 2 Day one foundation and registration

| **Work item**                        | **Owner**     | **Completion evidence**                                                                             |
| ------------------------------------ | ------------- | --------------------------------------------------------------------------------------------------- |
| I01 Repository and delivery skeleton | E1            | Web/API/worker start, database migration and health checks in CI.                                   |
| I02 Identity and tenant scope        | E1            | Login/invite/reset/session revocation; two-tenant deny tests and RLS baseline.                      |
| I03 Academic masters and roles       | E2            | Institution, campus, department, program, year, term, cohort and subjects editable by scoped admin. |
| I04 People and student import        | E2            | CSV/XLSX preview, duplicate/unknown-code errors and atomic valid commit.                            |
| I05 Exams and registration           | E2 with E1    | Frozen rules, both enrolment modes, eligibility and approve/reject states.                          |
| I06 Scheduling domain foundation     | E3            | Paper, hall, duty and seat schema plus overlap/capacity validation service.                         |
| I07 Result fixtures and pure engine  | E4            | Component calculation, thresholds, bands, absence/hold and GPA fixtures pass.                       |
| I08 Shared shell and demo fixtures   | E3/E4 with QA | Role navigation, school/college data and empty/error patterns.                                      |

## Suggested timeboxes

Hours 0–2 lock contracts and run the first migration. Hours 2–6 implement identity/academics and the first enrolment path while scheduling and result foundations proceed. Hours 6–8 integrate and run the day-one acceptance journey.

## Day one gate

A fresh deployment provisions two tenants. An institution administrator imports students and enrolments, creates an exam and opens registration. A school auto-enrol operation and a college application/approval operation both work. A student from tenant B cannot read, modify or export tenant A's records, including when IDs are known.

## Fixtures

Seed Northstar College with 100 students, three subjects and at least three faculty; Cedar School with a smaller auto-enrol cohort. Use fictional emails and no real student data. Include a duplicate roll row, an unknown subject, an inactive student, a rejected application and a faculty member with two department scopes.

If the tenant or registration gate fails, Day 2 first resolves it. Screens may be developed ahead, but no later slice should rely on unsafe fallback data access or direct database edits.

# 3 Day two examination operations

| **Work item**                           | **Owner**   | **Completion evidence**                                                               |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| I09 Schedule and hall allocation        | E3          | Conflict-free plan, deterministic seats and concurrent capacity protection.           |
| I10 Invigilator assignment              | E3          | Assign/accept/decline/reassign, overlap rejection and accepted coverage.              |
| I11 Timetable publication and admit PDF | E2/E3       | Readiness gate, versioned admit card and reschedule invalidation.                     |
| I12 Attendance and incidents            | E3          | Assigned roster, present/absent/late, final submission and controller reopening.      |
| I13 Files and secure papers             | E1          | Private quarantine/clean states, access windows, scoped downloads and no public URLs. |
| I14 Jobs and notifications              | E1/E2       | Durable outbox, claim leases, retries and truthful in-app/email status.               |
| I15 Marks input and review API          | E4          | Assignment, component validation, submit/return/approve and separation of duties.     |
| I16 Integration and regression          | QA with all | Schedule-to-admit-to-attendance journey and tenant regression pass.                   |

## Suggested timeboxes

Hours 8–12 complete schedule/hall/duty controls and private files. Hours 12–14 publish a schedule and produce current admit cards. Hours 14–16 simulate exam conduct and integrate marks submission. Keep result fixtures running as contracts evolve.

## Day two gate

Publish a timetable for the 100-student cohort with all seats and accepted duties. Attempt an overlapping student paper, an over-capacity room and an overlapping faculty duty; each fails without partial allocation. Reschedule one unstarted sitting and verify replacement admit cards and renewed acceptance.

An invigilator records attendance including one absent and one late student, files a student-linked incident, submits the roster and cannot alter it without authorized reopening. A student cannot fetch a paper file. An unassigned faculty member cannot enter marks.

## Practical failure cases

Disconnect or retry a save: the UI must preserve unsaved input and the API must avoid duplicates. Fail the document scan: publication is blocked with a visible reason. Kill the worker after claiming a PDF job: lease expiry makes it retryable without duplicate current documents. Email failure remains visible but does not reverse an otherwise successful schedule publication.

# 4 Day three results and pilot release

| **Work item**                       | **Owner**   | **Completion evidence**                                                                   |
| ----------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| I17 Marks review and reopening      | E4          | Full marks import/entry, distinct approver and reasoned corrections.                      |
| I18 Candidate result runs           | E4          | Snapshot calculation, revision check, reconciliation totals and blocked incomplete input. |
| I19 Publication and student outputs | E4/E2       | Atomic publication, own-result access, grade-card PDF, withdrawal and new version.        |
| I20 Dashboard and fixed reports     | E2/E3       | Role-scoped counts, CSV exports and audit filters.                                        |
| I21 Hardening and recovery          | E1          | Dependency scan, private configuration, clean migration and successful restore.           |
| I22 Acceptance and pilot handover   | QA with all | Complete fixtures and evidence bundle; institution sign-off owner named.                  |

## Suggested timeboxes

Hours 16–20 finish review, candidate runs and publication; hours 20–22 complete reports and document generation. Reserve hours 22–24 for the integrated acceptance run, fixes and release review. If critical work consumes that reserve, extend delivery rather than skipping the review.

## Day three demonstration

Run school auto-enrolment and college applications to published outcomes. Show a valid two-component result, an external-component failure, an absent result and a withheld result. Demonstrate a self-approval denial. Publish once, retry the command and confirm one publication. Withdraw, correct marks, reapprove and publish version 2; the student sees only version 2.

## Definition of done

Every requirement M01–M10 has an accepted workflow and its permission/validation behaviour. Required tests pass from a clean checkout. No critical/high unresolved defect remains in authentication, tenant access, paper access, grades or publication. Pilot restore and the deployment smoke test pass. The application has no production route that substitutes demo data when a service fails.

The full MVP is released only when every mandatory gate passes. An incomplete build may be demonstrated with fictional data and explicit limitations, but it must not be used to conduct a real examination.

## Estimate boundary

This plan is a dependency-aware timebox, not a guarantee of throughput. New authentication, scanning or PDF foundations, unfamiliar technology or unapproved academic rules can exceed it. Keep the scope baseline stable and re-estimate the remaining work rather than marking partial modules complete.

# 5 Required acceptance tests

Tests focus on costly failure modes and the complete business journey. Avoid high coverage claims based only on CRUD tests.

| **Test ID** | **Scenario**                    | **Required assertion**                                                                           |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| A01         | Two tenants, known foreign IDs  | Read/write/search/export/download deny; no data appears in logs or response.                     |
| A02         | Student and assignment scoping  | Student sees own records; examiner/invigilator cannot access unassigned data.                    |
| A03         | Tenant connection pool reuse    | Context does not leak between sequential/concurrent tenant transactions; missing context denies. |
| A04         | Malformed and duplicate imports | Entire invalid batch rejected; row counts reconcile; valid replay creates no duplicates.         |
| A05         | Window and eligibility          | Closed window/inactive enrolment reject; approval records input snapshot.                        |
| A06         | Seat and schedule concurrency   | Parallel allocation cannot double-book student, seat, room or invigilator.                       |
| A07         | Attendance and incidents        | NOT_MARKED blocks close; ABSENT differs from zero; hold hides numeric results.                   |
| A08         | Marks bounds and approval       | Reject out-of-range/stale saves and self-approval; return/reopen keeps history.                  |
| A09         | Result boundaries               | 74 PASS/B; total 54 with failed component FAIL; 39.995 FAIL; GPA example 8.20.                   |
| A10         | Revision race                   | Marks/hold change during compute invalidates candidate run; publish cannot use stale input.      |
| A11         | Publish retry and withdrawal    | One active publication; withdrawn result/download unavailable; new version is current.           |
| A12         | Private document access         | Pending/infected/out-of-window/unassigned fetches deny; signed URLs expire.                      |
| A13         | Worker crash and retry          | Expired lease resumes; one current PDF/result run per business key.                              |
| A14         | Account revocation              | Password reset, suspension and refresh replay prevent continued access.                          |
| A15         | Recovery                        | Restore database and referenced objects; verify record counts, files and active publication.     |

## Test layers and data

Use pure unit fixtures for result arithmetic, integration tests against real PostgreSQL for RLS/transactions/constraints, and browser end-to-end tests for one full school path and one full college path. Use controlled email and file adapters in tests, plus one real staging email and clean-file validation before pilot. The static prototype is not a substitute for these tests.

Record the commit, fixtures, results and evidence. Measure the proposed pilot workload; report actual latency and job duration.

# 6 Deployment support and handover

## Release procedure

Build from a tagged, reviewed commit. Run required checks and create immutable API/worker images and static assets. Back up the database, apply additive migrations using the migration role, deploy a compatible API/worker, then run health and scoped workflow smoke tests. Release public student traffic only after the controller verifies the current exam.

Keep runtime secrets in the deployment secret store, never source control. Configure allowed origins, cookie settings, institution timezone, private bucket keys, scanner and email credentials, job retry policy and the runtime database role. Do not expose a superuser connection to the application.

## Rollback and incidents

For application defects, roll back to the previous schema-compatible image and stop affected jobs if needed. Do not automatically reverse destructive migrations. For incorrect grades, withdraw publication and follow the academic correction workflow; an infrastructure rollback alone must not rewrite academic history.

For suspected cross-tenant access or paper exposure, restrict affected access, preserve audit evidence and engage the named technical and institution owners. Restore only after assessing writes since the backup. Communicate availability and outcome through the institution's approved support process.

## Handover pack

- Tagged repository, dependency lockfiles, Docker definitions and environment variable reference without secrets.
- Database schema/migrations, tenant role matrix, OpenAPI contracts and import templates with examples.
- Result fixture suite and approved grading policy, acceptance evidence, known limitations and measured performance.
- Setup, schedule, conduct, review, publication/withdrawal and retry operating instructions.
- Backup/restore procedure, successful restore evidence, monitoring links and named operational owners.

## Requirement to task mapping

| **Requirement** | **Implementation tasks** | **Acceptance tests** |
| --------------- | ------------------------ | -------------------- |
| M01 M02         | I01–I03, I21             | A01–A03, A14         |
| M03 M04         | I04–I05                  | A04–A05              |
| M05             | I06, I09–I11             | A06, A11             |
| M06 M07         | I10, I12–I13             | A02, A07, A12        |
| M08 M09         | I07, I15, I17–I19        | A08–A11              |
| M10             | I14, I20–I22             | A01, A13, A15        |

## Delivery status of this pack

These documents and the Mock UIs are planning and review deliverables. The ERP backend, security controls, actual email delivery and production PDF generation still require implementation and the tests above. No live institution deployment, compliance certification or production sign-off is implied.

Sources are the supplied ERP product discussion and the supplied ICAI RFP as mapped in the Proposal Document. Technical guidance is linked in the Architecture Document; all capacity, staffing and timing figures are explicit planning assumptions.