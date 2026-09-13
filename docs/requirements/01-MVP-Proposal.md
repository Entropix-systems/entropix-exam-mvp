Examination ERP MVP Proposal

Product scope and acceptance  
Entropix Systems | Product and engineering team

# 1 Product proposal

We propose an institution-owned examination workspace within an Entropix Systems multi-tenant SaaS. A school or college can prepare, conduct and close a written examination, from student enrolment to an approved, published result and downloadable grade card.

The MVP will prove one complete operational cycle. It supports multiple isolated institutions and a deliberately small set of academic and grading choices. The three-day target is a focused engineering sprint with a controlled pilot at the end, subject to the release gates in the Implementation Document. It is an estimate, not evidence that the platform is built or production-ready.

## Product outcome

The exam controller replaces disconnected student lists, hall plans, attendance sheets and marks spreadsheets with a shared record. Faculty work only on assigned duties. Students see only their own approved application, timetable, admit card and published result.

## Baseline decisions

| **Decision**      | **MVP boundary**                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Product identity  | Examination ERP SaaS by Entropix Systems; product name remains a working label.                                   |
| Customers         | Schools and colleges using written, institution-conducted examinations.                                           |
| Delivery channel  | Responsive web application for desktop and mobile browsers. Online connectivity required.                         |
| Tenant onboarding | Platform administrator provisions institution and first administrator; no public signup or subscription checkout. |
| Exam support      | One regular attempt per subject per exam; auto-enrolment and application modes.                                   |
| Result support    | One component or internal plus external; percentage grades; optional single-exam credit GPA.                      |
| Pilot assumption  | 2 demonstration tenants; up to 500 students and 10 subjects per exam. Capacity must be measured.                  |

## Document set

Read this proposal for scope, the Architecture Document for boundaries and data, the Solution Document for operational rules, and the Implementation Document for tasks and acceptance. The interactive Mock UIs illustrate the same MVP using fictional data.

# 2 Included capabilities

Each requirement ID is shared across the document set and mock screen catalogue. The following are release requirements, not separate products.

| **ID** | **Capability**            | **Minimum usable outcome**                                                                                                                |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| M01    | Institution and academics | Tenant, campus, department, program, academic year, term, cohort and subject records; school labels map class to cohort and year to term. |
| M02    | Identity and roles        | Provision/invite users, login, password reset, scoped role grants, activation and session revocation.                                     |
| M03    | Students and faculty      | Profiles, subject enrolments and CSV/XLSX student import with preview and row errors.                                                     |
| M04    | Exams and applications    | Exam rules, subjects, eligibility snapshot, auto-enrol or student application, approve/reject before cut-off.                             |
| M05    | Timetable and halls       | Schedule validation, room capacity, manual hall allocation with numbered seats, locked published timetable and admit-card PDF.            |
| M06    | Invigilation              | Assign, accept/decline and replace duties; assigned-hall attendance; incident reporting and closure.                                      |
| M07    | Documents                 | Versioned question-paper upload and timed access; notices, generated PDFs and access audit.                                               |
| M08    | Evaluation                | Examiner assignment, component marks entry and CSV/XLSX import, submit, return, approve and reasoned reopening.                           |
| M09    | Results                   | Deterministic calculation, reviewed snapshot, controlled publication/withdrawal, student result and grade-card PDF.                       |
| M10    | Common operations         | In-app and email events, delivery status, operational dashboard, fixed CSV reports and audit search.                                      |

## Meaning of full functionality

M01 through M10 must form a connected path. A marks screen without approval and publication, or a hall plan without conflict checks and admit-card refresh, is not complete. CRUD forms alone do not meet the MVP objective.

## Reusable school and college model

School mode auto-enrols eligible students from a class cohort. College mode allows applications for subjects already in the student's enrolment. Both use the same exam, registration, schedule and result models. The institution chooses one mode per exam; a published exam cannot switch modes.

# 3 Roles and accountability

Roles are fixed permission bundles for the MVP. A user may have several scoped grants; departments and assignments still constrain access. Owning an administrative account does not automatically confer result approval rights.

| **Role**                | **Scope**                 | **Responsibility**                                                                                                         |
| ----------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Platform Admin          | Platform metadata         | Provision/suspend institutions and first admins; view usage counts. No routine access to marks, papers or student records. |
| Institution Admin       | Own institution           | Branding, masters, people, role grants and account resets; cannot publish results unless explicitly granted Controller.    |
| Exam Controller         | Own institution           | Create exams, approve applications, publish schedules, assign duties, review marks, publish/withdraw results.              |
| Department Admin or HOD | Granted departments       | Verify enrolments and review assigned department marks; cannot publish institution results.                                |
| Faculty or Examiner     | Assigned subjects         | Upload authorized papers; enter and submit marks for assigned subjects only.                                               |
| Invigilator or Observer | Assigned hall sittings    | Accept duties; mark attendance and report incidents; no marks or draft results.                                            |
| Student                 | Own student record        | Apply, track status, view timetable, download own admit/grade card and view own published results.                         |
| Auditor                 | Granted institution scope | Read approved reports and audit; no mutation, unreleased papers or draft student results by default.                       |

## Separation of duties

The user who submits a marks batch cannot approve it, even if they also hold the Controller or HOD role. Another authorized person must approve. A controller can publish an approved result because publication is a separate controlled step. High-impact actions require confirmation, a reason where specified, and an audit entry.

## Ownership during the pilot

Entropix Systems owns software engineering, tenant isolation and operational recovery. Institution staff own student accuracy, eligibility decisions, grading policy and academic approval. A named exam controller signs off the fixture results and the first actual exam. The platform must not infer an institution's academic regulations.

# 4 Scope limits and assumptions

The MVP is an examination operations product. It does not include school admissions, fee collection, payroll, accounting, procurement, library management or a general ERP workflow designer.

## Explicit exclusions

- Native Android/iOS apps, offline sync, QR attendance, confidential-packet logistics, geo-tracking and face recognition.
- Online student testing, question banks, proctoring, on-screen answer-script annotation and AI marking.
- ICAI member validation, examiner qualification tests, empanelment lifecycle, workshops, billing and NetSuite/SSP integration.
- Subscription billing, payment gateways, SMS, parent portal, public certificate verification and enterprise SSO.
- Seating optimization, cross-institution campuses, complex multi-stage moderation, double evaluation, rank lists and historic CGPA.
- Supplementary attempts, revaluation, grace marks, arbitrary grading formulas and subject exemptions. Zero grace is the MVP rule.

## Proposed defaults that narrow the previous discussion

The result engine supports a single final percentage or two weighted components, configurable pass thresholds and contiguous percentage grade bands. Optional GPA is for this exam only. Grace marks and cumulative CGPA were exploratory ideas and are excluded from the three-day baseline. Moderation means correction and approval with reasons; it does not apply statistical scaling.

Each tenant can model several campuses, but the first validated pilot uses one campus per institution. Faculty duties are assigned manually. Hall seating is deterministic within manually selected rooms; the product does not optimize room choice or mixing of subjects.

## Delivery assumptions

The plan assumes reusable authentication/UI foundations, a ready deployment account, an email sender and four experienced engineers with shared QA/product support. If these are unavailable, preserve the same scope and extend the date. Do not hide unfinished controls behind working-looking screens.

The UI prototype is a review artifact with simulated roles and data. It supplies no authentication, durable record storage, email delivery or production document security. The architecture describes the system to implement, rather than the hosting technology used for the prototype.

# 5 Value and acceptance

## Acceptance journey

Provision an institution, configure its academic structure, import 100 students, create three subjects and a regular exam, approve registrations, publish a conflict-free timetable, allocate halls and accepted invigilators, issue admit cards, record attendance and an incident, enter marks, obtain independent approval, compute and publish results, then let a student download a grade card.

Repeat the isolation checks in a second tenant. Complete the school auto-enrol path and college application path. Validate an absent student, a held result, a failed subject, a returned marks batch and a withdrawn publication.

| **Measure**            | **Pilot acceptance target**                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Operational completion | Both enrolment modes reach an immutable published result and PDF without database edits.                   |
| Data quality           | Accepted + rejected import rows reconcile to the supplied file; duplicate retries create no extra records. |
| Result accuracy        | Every hand-calculated fixture agrees with stored percentage, status, grade and GPA.                        |
| Access control         | Cross-tenant, student-to-student, unrelated-department and unassigned-subject access tests pass.           |
| Workflow integrity     | Concurrent approvals, seat allocation and publication retries cannot duplicate or bypass gates.            |
| Reliability            | Restore test succeeds; failed jobs are visible and safely retryable.                                       |
| Accessibility          | Keyboard operation, visible labels, readable status text and usable mobile attendance flow.                |

## Proposed technical targets

For the pilot workload, target p95 under 1 second for ordinary API reads/writes at 50 concurrent active users, excluding uploads and asynchronous jobs. Target a 500-student result run within 60 seconds and one PDF within 15 seconds. These are test targets, not measured performance or contractual SLAs.

## Commercial boundary

No customer pricing, revenue forecast or cloud budget has been approved. The pilot requires engineering effort, database/compute/storage, email delivery and support time. Record actual usage before setting subscription tiers. Plans are manually assigned metadata in the MVP, with explicit configured limits rather than payment enforcement.

# 6 Risks and source traceability

| **Risk**                     | **Impact**                       | **Control or decision**                                                                            |
| ---------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Three-day scope pressure     | Incomplete end-to-end cycle      | Daily vertical-slice gates; postpone pilot if a safety or correctness gate fails.                  |
| Tenant data leakage          | Another institution sees records | Scoped repositories, composite foreign keys, RLS and adversarial access tests.                     |
| Incorrect academic policy    | Wrong grade or outcome           | Versioned exam rules, worked fixtures and institution approval before opening registration.        |
| Confidential paper exposure  | Exam integrity lost              | Private storage, authorization and availability window checks, clean upload gate and access audit. |
| Bad student imports          | Duplicate or mismatched results  | Preview, stable roll keys, all-or-nothing commit and reconciliation.                               |
| Staff self-approval          | Unreviewed results               | Server-enforced distinct submitter and approver.                                                   |
| Provider or deployment delay | Three-day demo slips             | Ready prerequisites; in-app status remains authoritative; no false email success.                  |

## Source register

S1 is the supplied file 93782exam-aps6085-rfp (1).md, Section IV. It provides examination operations patterns, not this product's complete scope. References below use printed RFP sections and pages rather than chat citation identifiers.

S2 is the project discussion supplied with this request: the decision to build an owned school/college examination ERP, eight roles, the full student lifecycle, modular monolith and three-day target. The MVP decisions in this pack refine that discussion.

| **Source location**                    | **Reused pattern**                            | **Product adaptation**                                                 |
| -------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| S1 sections 5.4, 5.6, 5.7; pages 14–15 | Scheduling, rosters, attendance and incidents | Campus halls and faculty invigilation.                                 |
| S1 sections 6.2–6.3; page 16           | Duty assignment, decline and reassignment     | Manual faculty assignment with acceptance.                             |
| S1 section 7.5; pages 20–21            | Confidential content access                   | Timed question-paper access for authorized staff.                      |
| S1 sections 8.1, 8.3–8.6; pages 23–24  | Masters, documents, communications and MIS    | Fixed MVP workflows and report catalogue.                              |
| S2 product discussion                  | Student applications through results          | New product requirements; not claimed as ICAI student lifecycle scope. |

## Baseline for engineering

Treat the scope and defaults in this pack as the proposed implementation baseline. Business owners may amend them before the sprint starts; any change must update rules, fixtures, screens and acceptance together. ICAI tender staffing, certifications, 60-day commissioning and AMC obligations do not transfer to this independent MVP.