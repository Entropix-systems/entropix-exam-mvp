# D1 Shared Contract Register

Status: D1 CONTRACT FREEZE

This file records the cross-module contracts agreed before parallel D1
implementation.

This is the PRE-D1 documentation freeze. Typed contracts in
`packages/contracts` must be aligned during D1 implementation while the shared
contract lock is held.

---

# Roles

The MVP has exactly eight canonical role bundles:

```text
PLATFORM_ADMIN
INSTITUTION_ADMIN
EXAM_CONTROLLER
DEPARTMENT_ADMIN
FACULTY
INVIGILATOR
STUDENT
AUDITOR
```

Role context is represented through scope or assignment rather than additional
role enum values:

```text
HOD       = DEPARTMENT_ADMIN with department scope
EXAMINER  = FACULTY with an evaluation assignment
OBSERVER  = INVIGILATOR with a duty/sitting assignment
```

`HOD`, `EXAMINER`, and `OBSERVER` are not canonical MVP role bundles.

## Authenticated institution and role context

Login accepts credentials only. After authentication, the server chooses the
oldest active institution membership with at least one role grant (breaking ties
by membership UUID); a platform administrator with no such membership enters the
platform context. A credentialed user with neither kind of access receives the
generic forbidden/no-access result.

Tenant sessions persist one `activeRole`. The resolved authorization context
contains that role plus every currently valid grant for the selected membership,
but permission and feature checks evaluate only the active role bundle. JWTs remain
identity hints and never carry authoritative role state.

```text
POST /api/v1/auth/context  { institutionId, role? }
GET  /api/v1/auth/me       → { email, context, sessionId, institutions }
```

Context switching accepts only an active institution membership belonging to the
authenticated user and, when supplied, a role currently granted on that
membership. A successful switch updates the session and live refresh-token
binding atomically, then returns a replacement access token. The browser reloads
`/auth/me` and remounts tenant screens so no tenant-local page state survives the
switch.

The staff access directory is cursor-paginated on the server:

```text
GET /api/v1/identity/memberships?cursor=<membership UUID>&pageSize=<1..100>
→ { institutionName, departments, pageSize,
    memberships: { items, nextCursor } }
```

The cursor must identify a visible staff membership in the active tenant.
Memberships backed by a Student profile or any `STUDENT` grant are excluded.
Internal user IDs are not returned in directory items; the Web UI displays names,
emails, institution names, and role labels instead of UUIDs.

---

# Academic Hierarchy

The tenant-owned academic hierarchy is:

```text
Tenant → Campus → Department → Program → Term → Cohort
```

Additional ownership and join contracts are:

```text
AcademicYear owns Term.
Subject belongs to Program.
Enrolment joins Student + Subject + Cohort.
Exam belongs to Term.
ExamSubject joins Exam + Subject.
```

All entity identifiers exposed through the API use UUIDs.

A01 exposes the tenant-derived academic surface below. `resource` is one of
`campuses`, `departments`, `programs`, `academic-years`, `terms`, `cohorts`, or
`subjects`.

```text
GET  /api/v1/academics
GET  /api/v1/academics/:resource/:id
POST /api/v1/academics/:resource
PUT  /api/v1/academics/:resource/:id
```

Reads require a current tenant context; create/update additionally require an
`INSTITUTION_ADMIN` grant. Tenant scope is never accepted from the request.
Codes are canonical uppercase values and unique in their documented tenant or
parent scope. Academic-year and term dates are ordered, term dates stay within
their academic year, and all parent IDs resolve inside the current tenant.
Delete is intentionally not part of the A01 surface.

The shared Web/API DTOs are defined in `packages/contracts/src/academics.ts`.
The list response is `AcademicStructureSnapshot`; create/update inputs and
records are mapped by `AcademicInputByResource` and
`AcademicRecordByResource`.

---

# Student Import Input

The frozen student-import contract remains `docs/STUDENT-IMPORT.md`.

Supported formats and required columns are:

```text
CSV or XLSX

roll_no
name
email
cohort_code
subject_codes
```

In CSV, `subject_codes` is pipe-delimited. Preview, atomic commit, validation,
row-number retention, and retry semantics are those documented in the frozen
student-import contract.

The typed A02 records and import results are defined in
`packages/contracts/src/people.ts`. The authenticated API surface is:

```text
GET  /api/v1/people/students?search=<text>&cursor=<student UUID>&pageSize=<1..100>
GET  /api/v1/people/students/:id
GET  /api/v1/people/faculty
POST /api/v1/people/student-imports/preview
POST /api/v1/people/student-imports/commit
```

Preview/commit accepts `{ fileName, sourceText }` for the demo CSV path. The
server computes the SHA-256 import identity. A committed identity is durable and
replays return the original result without creating students or enrolments.
Students with the `STUDENT` grant are scoped to the Student profile bound to
their current membership. Tenant scope and membership authority are never
accepted from the request.

The student directory is cursor-paginated by roll number and stable student ID.
Its response is `{ students, total, nextCursor, pageSize }`; `total` counts all
records matching the active tenant, role scope, and search rather than only the
current page. The default page size is 25.

`withTenant` accepts an optional transaction-options argument for bounded
long-running atomic work. Existing callers are unchanged; the A02 import commit
sets an explicit timeout and keeps the tenant context transaction-local.

---

# Registration States

The canonical states are:

```text
DRAFT
SUBMITTED
APPROVED
REJECTED
CANCELLED
```

The only controlled transitions currently documented for application-mode
registration are:

```text
DRAFT → SUBMITTED
SUBMITTED → APPROVED
SUBMITTED → REJECTED
REJECTED → SUBMITTED
APPROVED → CANCELLED
```

Auto-enrol may create an `APPROVED` registration directly after eligibility
validation. This is a validated creation path, not an arbitrary state change.

A03 defines `EligibilitySnapshot` in `packages/contracts/src/registration.ts`.
It retains `evaluatedAt`, the aggregate `eligible` decision, per-check results
for active student, correct term/cohort, active enrolments and the
controller-managed eligibility flag, plus the exact ExamSubject and Enrolment
UUIDs evaluated. `RegistrationSubject.id` is the stable approved-roster UUID
consumed by scheduling and evaluation.

The authenticated command surface is:

```text
GET  /api/v1/exams
POST /api/v1/exams
POST /api/v1/exams/:id/open-registration
POST /api/v1/exams/:id/close-registration
POST /api/v1/exams/:id/auto-enrol
PUT  /api/v1/exams/:id/my-registration
POST /api/v1/exams/registrations/:id/submit
POST /api/v1/exams/registrations/:id/approve
POST /api/v1/exams/registrations/:id/reject
POST /api/v1/exams/registrations/:id/cancel
POST /api/v1/exams/registrations/:id/eligibility
```

Student commands always resolve the Student profile from the authenticated
membership. Tenant and student authority are never accepted from request data.

All transitions are enforced server-side through commands. No other transition
is implied by this contract.

---

# Exam States

The canonical states are:

```text
DRAFT
REGISTRATION_OPEN
PREPARATION
SCHEDULE_PUBLISHED
EVALUATION
PUBLISHED
CANCELLED
```

The normal progression is:

```text
DRAFT
→ REGISTRATION_OPEN
→ PREPARATION
→ SCHEDULE_PUBLISHED
→ EVALUATION
→ PUBLISHED
```

`CANCELLED` is entered only through an explicit cancellation command. Exam state
changes occur through commands; there is no arbitrary state `PATCH`.

---

# Attendance States

The canonical values are:

```text
NOT_MARKED
PRESENT
ABSENT
LATE
```

Rules:

```text
NOT_MARKED blocks final attendance closure.
ABSENT is not equivalent to a zero mark.
LATE counts as attended.
```

---

# Marks Batch States

The canonical values are:

```text
DRAFT
SUBMITTED
RETURNED
APPROVED
```

The separation-of-duties invariant is:

```text
submitter != approver
```

---

# Published Result Outcomes

The only published result outcomes are:

```text
PASS
FAIL
ABSENT
WITHHELD
```

Incomplete required result input is a validation/blocking condition. It is not a
published outcome and must block computation/publication as applicable.

---

# Result Grading Policy

Result grading policy lives in immutable, validated `RuleVersion` JSON.

`RuleVersion` data is declarative configuration. General executable formulas or
code are not accepted as grading policy.

The shared input and canonical validated shapes are `ResultRuleInput` and
`ValidatedResultRule` in `packages/contracts/src/results.ts`. B01 validates the
input once; A03 persists only the canonical `VALIDATED_RESULT_RULE` snapshot.
The config cannot be mutated, and opening registration sets its one-time
`frozenAt` timestamp.

---

# API Conventions

The API contract uses:

```text
Base path: /api/v1
Identifiers: UUID
```

Success responses include:

```text
data
requestId
```

Error responses include:

```text
code
message
fieldErrors
requestId
```

HTTP semantics are:

```text
401 → unauthenticated
403 → forbidden
404 → inaccessible or not found
409 → stale or concurrent state
422 → business validation failure
```

Responses must not expose SQL, Prisma, or other raw database details.

---

# Optimistic Concurrency

Mutable aggregate commands use `expectedVersion` where concurrency matters.

The command must reject stale versions rather than silently overwrite another
actor's update.

---

# Idempotency

Retried authenticated business/admin side-effect commands use the `Idempotency-Key` header.

Login, refresh, logout, forgot-password, reset-password, and invitation acceptance
are authentication protocol operations. They use transactional one-time-token/session
semantics and are exempt from business idempotency. Refresh rotation must never
replay a cached response.

The idempotency key is scoped by:

```text
tenant + actor + operation
```

---

# Scheduling Entity IDs

The D1 scheduling foundation uses UUID identifiers for:

```text
ExamPaper
Hall
HallSitting
SeatAssignment
Duty
```

Typed A04 scheduling contracts live in `packages/contracts/src/scheduling.ts`.

```text
GET  /scheduling
POST /scheduling/halls
POST /scheduling/exams/:examId/initialize
PUT  /scheduling/papers/:paperId/schedule
POST /scheduling/papers/:paperId/allocations/preview
POST /scheduling/papers/:paperId/allocations/commit
POST /scheduling/exams/:examId/publish
```

- `ExamPaper` is one-to-one with `ExamSubject` and owns the half-open
  `[startsAt, endsAt)` schedule interval.
- Seat allocation consumes the stable approved `RegistrationSubject.id` roster
  identity. Selected `hallIds` order is room order; students are filled by roll
  number and seat numbering restarts at 1 in each room.
- Preview is non-reserving. Commit rechecks student overlap, hall overlap,
  capacity and `expectedVersion` under the tenant scheduling transaction lock.
- `Exam.scheduleRevision` increments only when a ready PREPARATION schedule is
  published. Editing a published paper or allocation returns the exam to
  PREPARATION until it is validated and published as a later revision.
- `SchedulingSnapshot` exposes tenant timezone, stable paper/hall/sitting/seat
  IDs, readiness totals and explicit unallocated students for Web and B04.

---

# Conduct, Attendance and Result-Hold Contract

Typed A05 contracts live in `packages/contracts/src/duties.ts`; canonical row
attendance values remain in `packages/contracts/src/evaluation.ts`.

```text
GET  /conduct
POST /conduct/sittings/:hallSittingId/duties
POST /conduct/duties/:dutyId/accept
POST /conduct/duties/:dutyId/decline
PUT  /conduct/sittings/:hallSittingId/attendance
POST /conduct/sittings/:hallSittingId/attendance/submit
POST /conduct/sittings/:hallSittingId/attendance/reopen
POST /conduct/sittings/:hallSittingId/incidents
POST /conduct/incidents/:incidentId/disposition
GET  /conduct/exams/:examId/result-state
```

- Invigilator authority is the server-resolved `AuthenticatedContext.membershipId`.
  Only its accepted `Duty` may read the roster, and only during the half-open
  paper conduct window may it save or submit attendance. Pending/declined duties
  never expose roster rows.
- `AttendanceBatch.version` is `0` before first save. Draft saves use
  `expectedVersion`; submission requires a persisted row for every allocated
  `SeatAssignment` and rejects any `NOT_MARKED` row. Submitted batches are locked
  until a controller reopens with an audit reason.
- `ConductResultState.attendance` is emitted only from submitted batches and is
  keyed by stable `RegistrationSubject.id`. `ABSENT` remains an explicit
  nonnumeric state with `attended=false`; `LATE` has `attended=true`.
- Incident dispositions are `OPEN`, `CLEARED`, `RETAIN_WITHHELD`, and
  `NO_RESULT_IMPACT`. Every affected student is a tenant-safe relational link to
  `RegistrationSubject`. `OPEN` and `RETAIN_WITHHELD` emit a result hold keyed by
  `studentId`; `CLEARED` and `NO_RESULT_IMPACT` do not.
- A hall incident without affected students is unresolved until a controller
  chooses `NO_RESULT_IMPACT`. `ConductResultState.ready` is false while a sitting
  lacks an accepted duty/submitted attendance or such a hall incident remains.
- Published results freeze attendance and incident disposition; the controller
  must withdraw publication before changing conduct state.
- Saving/submitting/reopening attendance and creating/disposing incidents advance
  `Exam.inputRevision`; an already computed result run is stale after any of
  these result-affecting conduct changes.
- B02/B03 must consume `GET /conduct/exams/:examId/result-state` (or the same
  `ConductResultState` type) and must not create duplicate attendance/hold tables.

---

# Evaluation, Marks Entry and Independent Review Contract

Typed B02 contracts live in `packages/contracts/src/evaluation.ts`. The
evaluation snapshot consumes the stable A03 `RegistrationSubject.id` roster and
the submitted A05 attendance/incident state.

```text
GET  /evaluation
PUT  /evaluation/subjects/:examSubjectId/assignment
PUT  /evaluation/subjects/:examSubjectId/marks
POST /evaluation/subjects/:examSubjectId/submit
POST /evaluation/subjects/:examSubjectId/return
POST /evaluation/subjects/:examSubjectId/approve
POST /evaluation/subjects/:examSubjectId/reopen
```

- `EvaluationAssignment` is the exact examiner authority for one `ExamSubject`.
  Examiner commands require the session-selected `FACULTY` role, use the
  server-resolved membership, and never accept an actor identity from the request
  body. A `FACULTY` grant alone does not grant access to an unassigned subject.
- Assignment and marks mutations use `expectedVersion`. A missing batch has
  version `0`; persisted assignment and batch versions start at `1`.
- Component columns and maxima come from the exam's frozen `RuleVersion`.
  Decimal values are strings at the HTTP boundary and are persisted as
  `DECIMAL(12,4)` after component, range and roster validation.
- Submission requires every approved roster row to have submitted attendance,
  no unresolved hall incident, and every configured mark for an attending
  student. `ABSENT` keeps external/final blank; incident-held students retain
  marks while downstream numeric results remain hidden.
- Batch states are `DRAFT`, `SUBMITTED`, `RETURNED`, and `APPROVED`. Only the
  assigned examiner in an active `FACULTY` context may edit `DRAFT`/`RETURNED`;
  return and approval require an active controller role or department
  administrator role scoped to the subject department.
  Approval also requires a reviewer membership distinct from the submitter and
  rechecks the authoritative roster, conduct state and mark completeness.
- Only an institution administrator or exam controller may reopen an approved
  batch, and a 5–500 character reason is required. Marks/review mutations update
  `Exam.inputRevision`, which B03 must capture and recheck before committing a
  result run.

---

# Result Run and Publication Contract

Typed B03 contracts live in `packages/contracts/src/results.ts`. Computation
consumes the frozen result rule, approved B02 marks, and submitted A05 conduct
state synchronously.

```text
GET  /results
GET  /results/student/current
POST /results/exams/:examId/compute
POST /results/exams/:examId/withdraw
GET  /results/runs/:resultRunId
POST /results/runs/:resultRunId/publish
```

- Only the session-selected `INSTITUTION_ADMIN` or `EXAM_CONTROLLER` role may
  compute, review, publish, or withdraw results. The student route resolves the
  current membership server-side and never accepts a student identifier.
- A `ResultRun` captures the exam, rule version, `Exam.inputRevision`, canonical
  input checksum, aggregate counts, and immutable per-subject/per-student
  snapshots. Repeating computation for the same unchanged revision returns the
  existing run.
- Computation is blocked until every scheduled sitting has accepted duty and
  submitted attendance, no hall-wide incident is unresolved, and every exam
  subject has an independently approved complete marks batch.
- `ABSENT` is never converted to zero. `ABSENT` and `WITHHELD` snapshots retain
  explicit outcomes while hiding the numeric values prohibited by the B01 rule
  contract. A student-level hold hides every subject's numeric result.
- Publish rechecks the current rule, input revision, and canonical input checksum
  inside the result transaction. A stale candidate is rejected and must be
  recomputed. Retrying publication of the active run is idempotent.
- At most one `Publication` per exam is current. Withdrawal requires a reason,
  removes student visibility, and returns the exam to `EVALUATION`; a corrected
  publication receives the next monotonically increasing version.
- Student reads return only the caller's own result from the current publication.
  Draft candidate runs, historical versions, and withdrawn publications are not
  student-visible. A `WITHHELD` response is a dedicated hold-message variant and
  contains no result item, component, percentage, GPA, or credit fields.

---

# Student Portal and Current Document Contract

Typed B04 contracts live in `packages/contracts/src/student-portal.ts`. Every
route below requires the session-selected `STUDENT` role and resolves both tenant
and student identity from the authenticated membership. No route accepts a
student identifier.

```text
GET /api/v1/me/student-portal
GET /api/v1/me/registrations
GET /api/v1/me/timetable
GET /api/v1/me/result
GET /api/v1/me/documents
```

- Registration reads contain only the caller's currently `APPROVED`
  registrations.
- Timetable, hall, and seat data is visible only while the exam has a published
  schedule state and every registered subject has a current paper and seat.
- Admit-card metadata binds its stable issue ID to the approved registration and
  current `Exam.scheduleRevision`. Editing a published schedule removes the
  current timetable/admit reference until the later revision is published.
- Result reads contain only an active current publication backed by an approved
  registration. Withdrawal removes result and grade-card visibility.
- `WITHHELD` returns only the publication/exam identity, explicit outcome, and a
  hold message. `PASS`, `FAIL`, and `ABSENT` may expose the immutable published
  snapshot and a current grade-card reference; `ABSENT` is never rendered as
  zero.
- Admit cards and grade cards are printable HTML for the demo. Their metadata
  has no public or signed file URL. Grade-card issue IDs bind to publication
  version; no persisted document table or storage object is introduced.

---

# Private Object Authorization and Recovery Contract

Private object download authorization is evaluated before a signed URL is
created. The server-resolved actor and persisted document access record must
agree on tenant, membership assignment, allowed active role, `CLEAN` scan state,
and the half-open `[availableFrom, availableUntil)` access window. Quarantine
keys are never downloadable. Generated and promoted-clean keys may be signed
only when the object exists, and URL lifetime is capped by both the configured
TTL and the remaining access window.

Durable asynchronous work uses tenant-owned `WorkerJob` and `WorkerOutput`
records. Both tables have forced RLS. A `(tenant, kind, businessKey)` identifies
one logical job and one logical output. Claims use row locking with
`SKIP LOCKED`; only `READY` jobs or expired leases may be claimed. A live lease
cannot be stolen, a stale owner cannot complete, and successful completion
atomically records one checksum-addressed output and clears the lease.

Release recovery evidence must restore the logical PostgreSQL backup and each
referenced private object. Verification compares tenant identities, tenant-owned
record counts, current publication identities/versions/result checksums, object
references and object checksums, and rechecks missing-context RLS in the restored
database.

---

# D1 Contract Freeze Checklist

- [x] Role enum strategy
- [x] Academic IDs and relationships
- [x] Student import input shape
- [x] Registration states
- [x] Exam states
- [x] Eligibility result shape — `EligibilitySnapshot` and per-check evidence
- [x] API error envelope
- [x] Optimistic version field
- [x] Result rule schema
- [x] Scheduling entity IDs
- [x] Migration owner — Developer A for A01 Academic Masters
- [x] Contract owner — Developer A

---

# D1 IAM Phase 1 Security Contract

The Phase 1 authorization is recorded in `docs/codex/IAM-PHASE1.md`.
Typed identity contracts live in `packages/contracts/src/context.ts` and `identity.ts`.

- `ScopedRoleGrant`: canonical tenant role plus nullable department UUID.
- `TENANT`: user UUID, tenant UUID, membership UUID, and scoped grants.
- `PLATFORM`: user UUID and `PLATFORM_ADMIN`; no tenant/membership fields.
- Permissions evaluate role and department on the same grant.
- Access tokens carry identity hints; current server authority remains mandatory.
- Configurable defaults: access 15 minutes, refresh 7 days, invitation 24 hours.
- Password-reset expiry is configurable. The implementation uses 30 minutes as a
  default, not a previously frozen product requirement.
- No 30-day absolute session lifetime is introduced.
- Refresh cookies are HttpOnly/SameSite and Secure except explicitly local development.
- Future User.platformRole is nullable and restricted to PLATFORM_ADMIN.

No Session/AuthToken schema or persistence is implemented in Phase 1.

---

# D1 IAM Phase 2 Application Contract

Phase 2 orchestration is recorded in `docs/codex/IAM-PHASE2.md`.

- Day-1 auth routes use the shared envelope and do not require `Idempotency-Key`.
- Unexpected server failures use `INTERNAL_ERROR` and the generic message
  `Request failed`; database and provider details remain private.
- The refresh credential is accepted only from the Phase 1 HttpOnly cookie.
- Cookie-authenticated refresh/logout require a configured exact Origin and the
  non-simple `x-csrf-protection: 1` header.
- Access tokens remain in browser memory and each protected request re-resolves
  current server authority. Concurrent ordinary 401 responses share one refresh.
- A missing institution selector can resolve only a legitimate platform context;
  platform users never receive fabricated tenant or membership identifiers.
- The API controller is not production-wired until real Session/AuthToken and
  invitation/reset transaction providers are available.

---

# D1 IAM Phase 3 Backend Contract

Migration `20260913120000_iam_phase3` supplies durable hash-only AuthToken,
Session, membership lifecycle/version, canonical role-grant scope and nullable
`User.platformRole`. Phase 2 auth routes are production-wired to PostgreSQL.

The fixed tenant-admin surface is:

```text
GET  /api/v1/identity/memberships
POST /api/v1/identity/invitations
PUT  /api/v1/identity/memberships/:id/role-grants
POST /api/v1/identity/memberships/:id/deactivate
POST /api/v1/identity/memberships/:id/activate
```

These routes require a current tenant `INSTITUTION_ADMIN`. Invitation and grant
inputs use canonical `{ role, departmentId }` grants; `PLATFORM_ADMIN` is rejected.
Membership reads/mutations are current-tenant only, foreign IDs are inaccessible,
and invitation responses never expose raw tokens. A01 Academics now provides real
tenant-scoped Department records. IAM still rejects `DEPARTMENT_ADMIN` grant writes
and disables that role until a follow-up consumes the A01 Department source; IAM
must not introduce a separate department model.
