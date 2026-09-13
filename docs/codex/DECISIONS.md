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
