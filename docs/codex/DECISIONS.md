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

## DEC-007 — Session-owned active institution role

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
