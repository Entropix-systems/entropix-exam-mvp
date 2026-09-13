# Examination ERP — Two-Engineer Three-Day Sprint

## Team Model

Two full-stack engineers share equal engineering responsibility.

Both engineers are capable of:

```text
frontend
backend
database
testing
integration
```

Parallel development is divided by domain ownership rather than Frontend vs Backend.

---

## Developer A Lane

Primary continuity:

```text
Platform + Operations
```

Equivalent to much of the original:

```text
E1 + E3
```

Primary areas:

```text
identity
tenant/access integration
academic support
scheduling
halls
duties
attendance
incidents
dashboard
hardening
recovery
```

---

## Developer B Lane

Primary continuity:

```text
Academic + Results
```

Equivalent to much of the original:

```text
E2 + E4
```

Primary areas:

```text
students
imports
exams
registration
eligibility
result domain
marks
approval
result runs
publication
student outputs
```

Ownership is temporary for parallel efficiency.
Both developers must understand and review both lanes.

---

# Day 1 — Registration Foundation

## Joint Start

Freeze shared contracts and first database boundary.

No independent contract or migration creation.

## Developer A

```text
identity workflows
role enforcement
academic/access support
scheduling domain foundation
shared role-aware shell support
```

## Developer B

```text
students/faculty
student import
exam configuration
eligibility
school auto-enrol
college application
approve/reject
pure result engine
```

## D1 Gate

Must demonstrate:

```text
two isolated tenants
Northstar student import
exam creation
college application/approval
Cedar school auto-enrol
known foreign tenant IDs denied
duplicate/invalid import handling
inactive student eligibility denial
```

If D1 gate fails, D2 starts by fixing it.

---

# Day 2 — Examination Operations

## Developer A

```text
schedule
hall allocation
deterministic seats
conflict checks
invigilator assignment
accept/decline/reassign
schedule publication
admit-card orchestration
attendance
incidents
controller reopening
```

## Developer B

```text
secure document business lifecycle
paper authorization
access windows
jobs/outbox integration
notification state
examiner assignment
marks input
marks submission
return/approval
separation of duties
```

## D2 Gate

Must demonstrate:

```text
100-student timetable
accepted duty coverage
student overlap rejection
hall over-capacity rejection
faculty overlap rejection
reschedule and admit-card replacement
PRESENT / ABSENT / LATE attendance
NOT_MARKED close prevention
student incident/result hold
student paper access denial
unassigned examiner denial
self-approval denial
```

---

# Day 3 — Results and Pilot Candidate

## Developer A

```text
dashboard
fixed reports
audit views
security/dependency hardening
clean migration verification
backup/restore
deployment smoke
acceptance evidence
```

## Developer B

```text
marks reopening/correction
input revision handling
result runs
snapshot validation
result reconciliation
publication
publish idempotency
student result access
grade-card PDF
withdrawal
publication v2
```

## Protected Final Window

The final two engineering hours are reserved for:

```text
full school journey
full college journey
acceptance regression
fresh checkout verification
D0 regression
staging smoke
restore validation
critical defect correction
release review
```

Do not consume this window with new functionality.

---

# Daily Integration Rhythm

```text
09:00
sync integration and verify SHA

09:00–09:30
joint contract/migration coordination

morning
parallel focused development

midday
small merge + integration

afternoon
parallel focused development

late afternoon
cross-review

end of day
integrated day gate
```

---

# Completion Principle

A screen is not a feature.

Feature completion requires:

```text
domain/database
+
API
+
scoped UI
+
validation
+
test
+
integration evidence
```
