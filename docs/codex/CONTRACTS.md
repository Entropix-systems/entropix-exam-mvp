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

---

# D1 Contract Freeze Checklist

- [x] Role enum strategy
- [x] Academic IDs and relationships
- [x] Student import input shape
- [x] Registration states
- [x] Exam states
- [ ] Eligibility result shape — eligibility behaviour and snapshot retention are documented, but no exact shared payload shape exists
- [x] API error envelope
- [x] Optimistic version field
- [x] Result rule schema
- [x] Scheduling entity IDs
- [x] Migration owner — Developer B
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
and invitation responses never expose raw tokens. Developer A must pull/rebase this
merge before final browser verification.
