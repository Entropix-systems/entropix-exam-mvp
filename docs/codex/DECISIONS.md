# Engineering Decision Log

Record only decisions that affect implementation.

Do not use this file as general meeting notes.

---

## DEC-001 — Repository Is Shared Context

Status: ACCEPTED

Decision:

```text
The Git repository is the canonical engineering context shared by both developers
and both Codex/ChatGPT accounts.
```

Consequence:

Individual chat history must not contain unique implementation knowledge required
to continue the project.

Important decisions must be committed into repository documentation, contracts,
tests or code.

---

## DEC-002 — Two Developer Domain Split

Status: ACCEPTED

Decision:

```text
Developer A → Platform + Operations continuity
Developer B → Academic + Results continuity
```

Both developers remain full-stack and share review responsibility.

Reason:

Reduce simultaneous edits to the same modules while preserving complete vertical
slice ownership.

---

## DEC-003 — Single Migration Lock

Status: ACCEPTED

Only one developer generates/modifies migrations at a time.

The other developer must pull/rebase after the migration is integrated.

---

## DEC-004 — Single Shared-Contract Lock

Status: ACCEPTED

Only one developer changes shared contracts/enums/DTOs at a time.

Cross-lane requirements must be coordinated before implementation.

---

## DEC-005 — D0 Is Immutable Baseline

Status: ACCEPTED

```text
d0-ready
```

remains the known-good engineering baseline.

Feature development must not weaken D0 guarantees to satisfy sprint timing.

---

## DEC-006 — IAM Browser Token and CSRF Transport

Status: ACCEPTED

Context:

The browser needs session restoration and token rotation without making a reusable
credential readable by application JavaScript.

Decision:

Access tokens live only in browser memory. Refresh tokens are opaque rotating values
delivered in the host-only HttpOnly SameSite=Lax cookie defined by IAM Phase 1.
Cookie-authenticated mutations require an exact allowed Origin and a non-simple
request header. Ordinary requests coordinate through one in-flight refresh promise.

Consequences:

Refresh/logout controllers require trusted origin configuration. A page reload uses
the refresh cookie to restore an access token. No localStorage, sessionStorage,
IndexedDB, cached refresh response or browser secret is part of the protocol.

Related task: D1 IAM Phase 2.

---

## DEC-007 — ExamPaper Owns Published Schedule Revisions

Status: ACCEPTED

Context:

Scheduling, invigilator duties and student documents need one stable source for
paper time, hall and seat references without duplicating the approved roster.

Decision:

`ExamPaper` is the one-to-one written-paper aggregate for an `ExamSubject` and
owns its half-open schedule interval. `SeatAssignment` references the stable A03
`RegistrationSubject.id`. Allocation commit uses a tenant-scoped advisory
transaction lock and deterministic roll-number ordering across explicitly
ordered halls. `Exam.scheduleRevision` advances only on successful publication;
editing a live schedule returns it to PREPARATION.

Consequences:

B04 and duty work consume the persisted paper, hall-sitting, seat and revision
IDs. Preview never reserves seats, and all conflicts/capacity are rechecked when
the allocation is committed or the schedule is published.

Related task: A04 Timetable, Halls & Seats.

---

## DEC-008 — Conduct Owns Attendance and Result Holds

Status: ACCEPTED

Attendance is a versioned batch per persisted `HallSitting`; its rows reference
the existing deterministic `SeatAssignment` roster. Result consumers use only
submitted attendance and retain the explicit `ABSENT`/`LATE` states rather than
converting them to marks.

Incidents link affected students through `RegistrationSubject`. An `OPEN` or
`RETAIN_WITHHELD` incident is the authoritative result hold; clearing requires a
controller reason, and a hall-wide incident without affected students requires
an explicit `NO_RESULT_IMPACT` closure.

Affected modules: Conduct, Evaluation/Marks, Results, Publication.

Related task: A05 Duties, Attendance & Incidents.

---

## DEC-009 — Session-owned active institution role

Status: ACCEPTED

Context:

One user may belong to multiple institutions and hold multiple role grants. Using
all grants simultaneously made the browser's displayed role diverge from the
permissions the API actually granted, while requiring an institution slug at login
split one account into several sign-in paths.

Decision:

Login is credentials-only. A tenant Session persists one server-validated
`activeRole` alongside its tenant and membership binding. The context-switch
command may select only the authenticated user's active memberships and grants and
updates the session and refresh binding atomically. Authorization evaluates only
the selected role; all grants are returned solely to populate the role switcher.

Consequences:

Institution and role switches issue a new access token and force tenant screens to
remount. `/auth/me` supplies verified institution names and the signed-in email.
No client request can assert tenant authority, and removing the selected grant
invalidates subsequent authority resolution and refresh.

Related task: QA-01 through QA-06 IAM context follow-up.

---

## DEC-010 — Evaluation Assignment and Exam Input Revision Are Authoritative

Status: ACCEPTED

Context:

Marks entry needs assignment-scoped authority, an independently reviewed batch,
and a stable way for result computation to detect changed inputs without
duplicating the A03 roster or A05 conduct state.

Decision:

`EvaluationAssignment`, evaluated while the session's active role is `FACULTY`,
is the exact examiner authority for an `ExamSubject`.
`MarksBatch` owns the versioned DRAFT → SUBMITTED → RETURNED/APPROVED lifecycle
and its component `Mark` rows. Reviewer scope comes from controller authority or
the subject department, and approval is denied when reviewer and submitter
memberships match. `Exam.inputRevision` is the canonical result-input
invalidation token and advances when mark data, review state, or an approved
batch reopen changes the candidate inputs.

Consequences:

B03 must compute only from approved marks plus authoritative submitted conduct
state, capture `Exam.inputRevision`, and recheck the revision before committing a
result run. Reopening approved marks requires a controller reason and invalidates
any candidate result computation that captured an earlier revision.

Affected modules: Evaluation/Marks, Conduct, Results, Publication.

Related task: B02 Marks Entry & Independent Review.

---

## DEC-011 — Immutable Result Runs and Single Current Publication

Status: ACCEPTED

Context:

Result review needs reproducible evidence while correction workflows must not
silently change an already reviewed candidate or expose draft data to students.

Decision:

Every computation persists an immutable `ResultRun` plus per-subject
`ResultItem` and per-student `StudentResult` snapshots. The run captures the
frozen rule version, `Exam.inputRevision`, and a canonical input checksum.
Publication rechecks all three under a tenant/exam transaction lock. An exam has
at most one current `Publication`; withdrawal clears current visibility, and a
corrected publication creates the next version rather than overwriting history.

Consequences:

Result-input changes in Evaluation or Conduct advance `Exam.inputRevision` and
make earlier candidates unpublishable. Compute and publish retries are
idempotent for unchanged input. Students resolve only their own row from the
current publication; candidate, historical, and withdrawn snapshots remain
controller-only. PostgreSQL triggers deny update/delete of immutable result
snapshots, and a partial unique index enforces one current publication per exam.

Affected modules: Conduct, Evaluation/Marks, Results, Publication, Student UI.

Related task: B03 Result Runs & Publication.

---

## DEC-012 — Request-Level Immutable Audit Events

Status: ACCEPTED

Context:

The dashboard and reports lane needs real operator activity without reconstructing
history from mutable business tables or adding audit writes independently to
every command transaction during the demo sprint.

Decision:

Successful mapped tenant command requests append one `AuditEvent` containing the
server-resolved membership and active role, action, target, optional supplied
reason, request ID, and timestamp. Events are tenant-scoped, immutable, and
idempotent by tenant/request ID. Failed requests, reads, authentication activity,
and pre-migration history do not produce or imply events. Audit-write failure is
reported operationally but does not roll back a business command that already
committed.

Consequences:

Audit screens show only persisted post-migration activity. The request-level
boundary is sufficient for demo traceability but is not a transactional outbox;
a later production-hardening task may move critical command auditing into the
same database transaction or a durable outbox.

Affected modules: API command boundary, Audit, Dashboard/Reports, Database.

Related task: B05 Dashboard, Reports, Audit & Demo Polish.

---

## New Decision Template

### DEC-XXX — Title

Status:

```text
PROPOSED / ACCEPTED / REJECTED / SUPERSEDED
```

Context:

...

Decision:

...

Consequences:

...

Related task/commit:

...
