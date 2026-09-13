# D1-A — Platform, Identity and Scheduling Foundation

## Owner

Developer A

## Goal

Deliver the D1 Platform + Operations slice without breaking the D0 security foundation.

---

## Primary Scope

```text
actual identity workflow
role/scoped authorization integration
academic/access support required by D1
scheduling domain foundation
shared role-aware application shell support
```

---

## Expected Deliverables

### Identity

Implement/integrate the D1-required flows:

```text
login
invite
password reset
session handling
session revocation
account activation/deactivation behaviour required by MVP
```

Preserve established D0 database/session security assumptions.

### Academic / Access Support

Support scoped administration for the academic structures required by the D1 integrated flow.

Coordinate shared models/contracts with D1-B.

### Scheduling Foundation

Prepare domain/schema/services for:

```text
ExamPaper
Hall
HallSitting
SeatAssignment
Duty
```

Implement reusable validation foundation for:

```text
time overlap
hall capacity
student conflicts
faculty duty conflicts
```

D1 does not require the full D2 schedule UI/publication journey.

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

Coordinate with D1-B before modifying:

```text
packages/contracts
academic entity identifiers
exam identifiers
registration-related contracts
Prisma schema/migrations
```

Respect migration and contract locks.

---

## Must Not Do

Do not:

```text
disable RLS
bypass withTenant(...)
connect runtime through superuser/migration role
create duplicate role/status definitions
implement full D2 timetable publication
introduce public storage access
rewrite unrelated D0 infrastructure
```

---

## Tests

At minimum add/run focused tests for:

```text
authentication flow
revocation
role restrictions
tenant isolation regression
scheduling overlap validation
capacity validation
```

Run appropriate existing D0/security regression tests after integration.

---

## D1-A Completion

Report:

```text
implemented functionality
files changed
contracts changed
migration details
tests/results
known limitations
handoff requirements for D1-B / D2
```
