Examination ERP MVP Solution

Workflows and business rules  
Entropix Systems | Product and engineering team

# 1 End to end solution

The solution connects ten MVP capability groups into one controlled examination cycle. It is designed for institution staff operating written examinations, with a student portal for applications and published outcomes. The workflows below are the proposed business behaviour to implement.

## Normal operating sequence

Institution setup and accounts → academic structure and enrolments → exam rules and student registration → timetable, hall seats and invigilators → published admit cards → attendance and incidents → examiner marks → independent approval → result computation → controller publication → student result and grade card.

Different subjects may be evaluated at different times, but publication is exam-wide. A controller sees a readiness checklist before every major transition. The system reports the specific missing records instead of simply disabling an action.

| **Step** | **Actor**             | **Evidence retained**                                                               |
| -------- | --------------------- | ----------------------------------------------------------------------------------- |
| Set up   | Institution Admin     | Academic masters, role grants and import reconciliation.                            |
| Register | Student or Controller | Approved subject set and eligibility snapshot.                                      |
| Prepare  | Controller            | Timetable revision, seat allocation, accepted duty coverage and document readiness. |
| Conduct  | Invigilator           | Subject attendance, timestamps, incidents and duty completion.                      |
| Evaluate | Examiner and reviewer | Versioned marks batch, submission, return and independent approval.                 |
| Publish  | Controller            | Rule version, result input revision, approval record and publication version.       |
| Consume  | Student               | Own published result and issued grade-card version.                                 |

## Two supported examples

A school creates its annual exam for Class 10 A, selects auto-enrolment and a single 100-mark component with a 40% subject pass threshold. Active enrolled students are checked and enrolled as one operation, with invalid rows shown for correction.

A college creates a Semester 3 exam, selects applications, configures 40% internal and 60% external weight, and opens a registration window. Students choose only their enrolled subjects. The controller approves eligible applications before scheduling.

Both examples use the same status machine and permission checks. The examples are proposed fixtures, not institution-approved regulations. GPA remains optional and uses only this exam's credited subjects.

# 2 Setup enrolment and eligibility

## Institution and people

Platform Admin creates the tenant and sends a one-time invitation to its first Institution Admin. The latter sets branding, timezone, campus and academic structure, creates faculty accounts, imports students and grants roles. Faculty may act as examiner and invigilator through separate assignments.

Student import requires roll_no, name, email, cohort_code and subject_codes. Codes must already exist. CSV/XLSX preview shows row numbers, duplicates and unknown references. Commit is atomic only when all rows are valid; the user corrects and reuploads an invalid file. Existing roll numbers are rejected in the create import. Editing a student's enrolments is an explicit separate operation.

## Eligibility

MVP eligibility checks active student status, membership in the exam term/cohort, active subject enrolment and a controller-managed eligibility flag with reason. It does not infer fee clearance or class attendance percentages because those source systems are outside scope.

An exam freezes a rule version when registration opens. School auto-enrolment runs the same checks as application mode. A student application can include a subset of currently enrolled exam subjects; no free-text subject entry or cross-term registration is allowed.

| **Registration state** | **Allowed next state** | **Actor and condition**                                          |
| ---------------------- | ---------------------- | ---------------------------------------------------------------- |
| DRAFT                  | SUBMITTED              | Student in application mode, within window.                      |
| SUBMITTED              | APPROVED or REJECTED   | Controller rechecks eligibility and records rejection reason.    |
| REJECTED               | SUBMITTED              | Student corrects before the cut-off; previous decision retained. |
| APPROVED               | CANCELLED              | Controller before schedule publication with reason.              |
| No record              | APPROVED               | Auto-enrol command; all eligibility checks pass.                 |

After registration closes, students cannot submit or revise. A controller may reopen the window only before schedule publication, with reason and audit. After publication, registrations and subjects are frozen for this MVP; emergency roster changes require a controlled rollback to preparation and new admit cards.

## Duplicate and concurrent submissions

The unique exam/student registration and registration/subject keys prevent duplicates. Idempotency makes retries return the existing result. Approval stores the eligibility inputs used, reviewer and timestamp. Deactivating a student never erases an existing approved exam history.

# 3 Scheduling papers and duties

## Timetable and hall allocation

Each exam subject has one paper sitting with start and end timestamps. Sessions use half-open intervals, so 10:00–12:00 and 12:00–14:00 do not overlap. A student's approved subjects cannot overlap; neither can a hall's usage or a faculty member's active duties. All times are entered and displayed in the institution timezone.

The controller chooses rooms and students. The system assigns seat numbers by roll number within the selected room order, checks capacity and shows unallocated students. Preview does not reserve seats; commit rechecks conflicts under the scheduling lock. No automatic room optimization or special accommodation algorithm is included.

At least one accepted invigilator is required for each hall sitting. The controller may configure a higher positive count. Declining a duty releases that assignment for replacement and keeps the hall unready until a replacement accepts. Manual assignment cannot override a time conflict.

## Readiness and publication

Schedule publication requires all approved registration subjects allocated once, no conflicts, valid paper times, adequate accepted duties and a clean question-paper version attached with an access window. Students receive in-app/email notice and an admit-card generation job.

Question papers are visible to explicitly authorized staff only. Examiner paper-upload permission is separate from marks permission; invigilators may download only the paper for their assigned sitting during the allowed window. Students never receive a question-paper download endpoint in the MVP.

## Admit cards and changes

The PDF includes institution, student identity and roll number, exam, subjects, local times, hall/seat and instructions. It carries the timetable revision and issue identifier. It is generated only for approved registrations after schedule publication.

A controller may revise a published schedule before conduct begins, with a reason. The system revalidates all conflicts, increments the timetable revision, invalidates old current admit-card references and notifies affected users. A date/time or hall change resets affected duty acceptance to pending; republishing waits for coverage. Conducted sittings cannot be rescheduled in the MVP.

## Preparation states

Exam moves DRAFT → REGISTRATION_OPEN → PREPARATION → SCHEDULE_PUBLISHED. Closing registration enters PREPARATION. Cancelling is allowed before conduct with a reason; cancellation suppresses current admit cards and student result publication. No endpoint accepts an arbitrary state value.

# 4 Exam conduct and evaluation

## Conduct

The controller starts conduct only after schedule readiness. An accepted invigilator sees assigned hall rosters on a mobile-friendly page. Attendance begins as NOT_MARKED and may become PRESENT, ABSENT or LATE. LATE counts as attended. Each change records actor, time and version.

Invigilators may save drafts during the sitting and submit final attendance by the configured deadline. After submission only the controller may reopen it, with a reason and audit. An unresolved NOT_MARKED student blocks closing that sitting. A duty is complete only when attendance is submitted and its incident checklist is completed.

Incidents record category, paper, hall, optional student, narrative and optional clean attachment. Student-linked open incidents create a result hold. The controller may clear the case or retain WITHHELD with a reason. A hall-wide incident requires the controller to identify affected students or explicitly close it as having no result impact; the system does not automatically fail an entire hall.

## Evaluation

Controller assigns one examiner per subject. Examiner sees the authorized approved roster and attendance status. Each subject uses either FINAL or INTERNAL and EXTERNAL component columns from the frozen rule. Values use decimal arithmetic and must be between zero and the component maximum.

Absent students have a blank external/final mark and outcome ABSENT; entering zero is not a substitute for absence. Internal marks may be retained for an absent two-component student but no final numeric outcome is produced. Held students retain draft marks but are not released as numeric results until the hold clears.

## Review loop

MarksBatch moves DRAFT → SUBMITTED → APPROVED or RETURNED. RETURNED allows examiner edits and resubmission. A reviewer must be a scoped HOD or Controller distinct from the submitter. Approval checks completeness, range, attendance, incident dispositions and expected version.

Reopening an approved batch requires Controller authority and a reason. If the exam is already published, withdraw its active publication first. Reopening invalidates candidate runs and increments the input revision. Reassignment changes who can edit the batch but preserves historical submitter/reviewer identities.

Exam enters EVALUATION only when all sittings have submitted attendance and reviewed incidents. Completion requires every subject batch approved, including rows explicitly marked ABSENT or WITHHELD. No examiner can publish results.

# 5 Result rules and worked examples

## Calculation contract

For each numeric subject outcome, final percentage = sum of (component score ÷ component maximum × component weight). Weights are percentages summing exactly to 100. A single component has weight 100. Maximums must be positive, thresholds must lie within range, and grades cover \[0,100\] without gaps or overlap.

Use decimal arithmetic. Compare pass thresholds and grade boundaries on the unrounded percentage; round only displayed percentages to two decimals using half-up. Component pass thresholds are optional but, when configured, each component must pass as well as the subject total. A failed threshold yields FAIL and grade F regardless of total percentage.

Proposed example bands are A 80–100 inclusive at the top, B 60–below 80, C 40–below 60, and F below 40. Example points are 10, 8, 6 and 0 respectively. Institutions may configure bands and points before registration opens.

| **Input**                                     | **Computation**                                | **Expected outcome**                                                   |
| --------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Internal 32/40; external 42/60; weights 40/60 | 32/40×40 + 42/60×60 = 74                       | PASS, B, 8 points when total pass is 40 and component thresholds pass. |
| Internal 36/40; external 18/60                | Total 54; external 30% is below configured 40% | FAIL, F, 0 points despite total 54.                                    |
| Single component 39.995/100                   | Display 40.00; raw value below 40              | FAIL, F; screen states decisions use unrounded values.                 |
| Attendance ABSENT                             | No final percentage is computed                | ABSENT; blank percentage and grade, 0 GPA points.                      |
| Open student incident                         | Pending or retained hold                       | WITHHELD; numeric result and GPA hidden.                               |
| PRESENT and missing required mark             | Incomplete input                               | ERROR; result run and publication blocked.                             |

## Aggregate results and GPA

Overall percentage is the equal-weight mean of subject percentages only when every subject has a numeric outcome. Credits affect GPA, not overall percentage. If any subject is WITHHELD the student outcome is WITHHELD; otherwise ABSENT takes precedence over FAIL; all subjects must pass for PASS. Any absent or withheld subject suppresses the overall percentage.

For GPA-enabled exams, GPA = sum(credit × grade points) ÷ sum(credits), rounded half-up to two decimals. Include failed and absent subjects with zero points and their credits in the denominator. Withheld results suppress GPA. Example: credits 3/4/3 and points 8/10/6 give 82/10 = 8.20. Zero or missing credits block GPA-enabled configuration. Historic CGPA and grace are excluded.

# 6 Publication notifications and reports

## Compute review publish

Controller requests a result run after all approved batches and attendance are complete. The worker records the rule version, input revision, checksum and row counts. Validation errors stop the run with actionable student/subject references. WITHHELD and ABSENT are valid explicit outcomes, not missing data.

The review page lists candidate count, pass/fail/absent/withheld totals, missing-data errors and the rule version. Controller checks a sample against approved marks and confirms publication of this specific run. Server-side publication rechecks that the run is current. The exam becomes PUBLISHED only after its active pointer and audit record commit together.

Student APIs resolve the authenticated student and active publication. Draft and withdrawn data cannot be accessed by changing a URL. Withheld students see a hold message without component marks, percentage or GPA. Grade cards are available only for released PASS, FAIL or ABSENT outcomes, clearly labelled; held students get no grade card.

## Correction after publication

Controller withdraws the whole exam publication with a reason. Students see temporarily unavailable, and current grade-card links stop being issued. The original publication remains in audit. Correct/reapprove marks or incident disposition, compute a new run, then publish a new numbered version. Previously downloaded PDFs cannot be recalled; their issue number allows comparison with the current version.

## Communication events

MVP events are account invitation/reset, application decision, duty assignment/change, timetable publication/change, marks return/deadline reminder and result publication/withdrawal. In-app records are authoritative. Email states are QUEUED, ACCEPTED, DELIVERED only when confirmed, FAILED and UNKNOWN. Messages contain a portal link rather than marks or papers.

| **Report**                | **Scope and fields**                                   | **Format**                |
| ------------------------- | ------------------------------------------------------ | ------------------------- |
| Registration roster       | Exam, student roll, subjects, eligibility, decision    | CSV                       |
| Timetable and hall roster | Paper, time, room, seat, student and invigilator       | CSV; student admit PDF    |
| Attendance and incidents  | Exam/subject/hall, attendance and disposition          | CSV                       |
| Evaluation progress       | Subject, assigned examiner, submitted/approved count   | CSV                       |
| Result register           | Current publication, roll, outcome, percentage and GPA | CSV; individual grade PDF |
| Audit activity            | Date, actor, action, object, reason and request ID     | CSV                       |

All exports apply tenant and role scope, log generation, escape spreadsheet formula prefixes and avoid confidential document contents. Dashboard totals use the same definitions as these reports.

# 7 UI specification and traceability

The companion prototype uses fictional Northstar College and Cedar School tenants. Role selection is a demonstration control. The production application must derive its visible actions from server permissions, never from a user-selectable role menu.

| **Screen**                 | **Requirement IDs** | **Primary actions and states**                                         |
| -------------------------- | ------------------- | ---------------------------------------------------------------------- |
| S01 Dashboard              | M04–M10             | Readiness, blockers, progress and next task.                           |
| S02 Setup and access       | M01–M02             | Academic structure, school/college mode and fixed roles.               |
| S03 Students and import    | M03                 | Search, preview valid/error rows, commit only a valid batch.           |
| S04 Exam and registrations | M04                 | Create configuration, approve/reject and track window.                 |
| S05 Timetable and halls    | M05                 | Room capacity, allocation, conflict feedback and admit-card preview.   |
| S06 Duties and attendance  | M06                 | Accept duty, mark roster and submit attendance.                        |
| S07 Papers and notices     | M07                 | Version/access window, restricted and pending-scan states.             |
| S08 Marks and review       | M08                 | Edit marks, validate, submit, return and independent approval.         |
| S09 Results                | M09                 | Compute, view blockers, publish/withdraw and version history.          |
| S10 Student portal         | M04, M05, M09       | Own application, timetable, admit card, result and grade-card preview. |
| S11 Reports and audit      | M10                 | Filter operational records and inspect simulated audit changes.        |

## Interaction and accessibility rules

Use clear labels and validation beside the field, plus a focused summary on submission errors. Do not convey status through colour alone. Keep table headers visible, use keyboard-reachable controls, preserve focus after dialogs, and prevent loss of unsaved marks. On narrow screens, attendance becomes one student per row with large controls; dense administrative tables scroll within their container.

Every data view needs loading, empty, forbidden and retryable error states. Disable duplicate submissions while pending, but also protect them at the API. Confirm publication and withdrawal with the exact exam and version. Announce asynchronous status updates for assistive technology.

## Source and decision register

S1 is the supplied ICAI RFP, particularly sections 5.4–5.7, 6.2–6.3, 7.5 and 8.1–8.6. S2 is the supplied project discussion defining the independent student lifecycle. Attendance, assignments and governance adapt S1; student grading and publication are S2 product design decisions. The detailed defaults in this document are proposed MVP rules to validate with the pilot institution.

Mock actions illustrate key states with in-memory data. They are not acceptance evidence for APIs, database isolation, real email, upload scanning or PDF generation. Those behaviours must be verified against the real implementation.