# D1-B — People, Registration and Result Engine Foundation

## Owner

Developer B

## Goal

Deliver the D1 Academic + Results slice and complete the business side of the D1 registration gate.

---

## Primary Scope

```text
students/faculty
student import
exam setup
eligibility
registration
school auto-enrol
college application
approve/reject
pure result engine
```

---

## Student and Faculty

Implement the profiles and enrolment relationships required by the MVP.

Use tenant-safe repositories/transactions.

---

## Student Import

Support:

```text
CSV/XLSX
preview
row-level errors
duplicate roll detection
unknown-code validation
atomic commit
safe retry behaviour
```

Use the fictional acceptance fixtures.

---

## Exam and Registration

Implement:

```text
exam creation
exam subjects/rules required by D1
registration window
eligibility snapshot
school auto-enrol
college student application
controller approval
controller rejection
allowed corrections/resubmission where in scope
```

Enforce workflow transitions on the server.

---

## Pure Result Engine Foundation

Implement deterministic pure functions/fixtures for:

```text
single component
internal + external components
weighted calculation
component thresholds
grade bands
PASS
FAIL
ABSENT
WITHHELD
optional single-exam GPA
```

Use decimal-safe behaviour.

This is the calculation foundation only.
Full persisted result-run/publication workflow belongs to D3.

---

## Dependencies

Read:

```text
AGENTS.md
docs/codex/CONTEXT.md
docs/codex/CURRENT-STATE.md
docs/codex/CONTRACTS.md
docs/codex/ACCEPTANCE.md
```

D1 contract freeze must happen before implementation.

---

## Shared Boundaries

Coordinate with D1-A before modifying:

```text
packages/contracts
academic IDs
exam IDs
Prisma schema/migrations
role definitions
API error contract
```

Respect migration and contract locks.

---

## Must Not Do

Do not:

```text
manually patch the DB
bypass tenant/RLS access
duplicate shared status enums
invent academic rules not in the shared context
implement D3 result publication
treat rounded display percentage as calculation input
```

---

## Tests

At minimum add/run focused tests for:

```text
valid student import
duplicate roll
unknown subject
atomic invalid import
inactive eligibility
school auto-enrol
college application
approve/reject state transitions
result arithmetic fixtures
ABSENT/WITHHELD handling
GPA fixture
tenant access regression
```

---

## D1-B Completion

Report:

```text
implemented functionality
files changed
contracts changed
migration details
tests/results
known limitations
handoff requirements for D1-A / D2
```
