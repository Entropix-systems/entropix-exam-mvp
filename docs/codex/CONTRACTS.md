# D1 Shared Contract Register

This file records cross-module contracts that must be agreed before parallel implementation.

Do not treat this document as a replacement for typed contracts in `packages/contracts`.

Typed contracts remain authoritative once implemented.

---

# Roles

Proposed MVP roles include:

```text
PLATFORM_ADMIN
INSTITUTION_ADMIN
EXAM_CONTROLLER
DEPARTMENT_ADMIN
HOD
FACULTY
EXAMINER
INVIGILATOR
OBSERVER
STUDENT
AUDITOR
```

Before D1 implementation begins, confirm whether aliases such as:

```text
FACULTY / EXAMINER
INVIGILATOR / OBSERVER
DEPARTMENT_ADMIN / HOD
```

are represented as separate enum values or one role with assignment context.

Do not let each feature decide independently.

---

# Attendance States

Expected shared values:

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

# Registration States

Expected state model:

```text
DRAFT
SUBMITTED
APPROVED
REJECTED
CANCELLED
```

Expected transitions include:

```text
DRAFT → SUBMITTED
SUBMITTED → APPROVED
SUBMITTED → REJECTED
REJECTED → SUBMITTED
APPROVED → CANCELLED
```

Auto-enrol may create an APPROVED registration directly after eligibility validation.

Final implementation must enforce transitions server-side.

---

# Exam Preparation States

Expected progression:

```text
DRAFT
→ REGISTRATION_OPEN
→ PREPARATION
→ SCHEDULE_PUBLISHED
```

Additional later states will be confirmed as conduct/evaluation/publication implementation proceeds.

No API should accept an arbitrary workflow state string.

---

# Marks Batch States

Expected values:

```text
DRAFT
SUBMITTED
RETURNED
APPROVED
```

Key invariant:

```text
submitter != approver
```

---

# Result Outcomes

Expected values:

```text
PASS
FAIL
ABSENT
WITHHELD
```

Incomplete required result input must block result publication rather than silently
produce a normal numeric result.

---

# API Error Contract

Before feature implementation begins, confirm the existing shared error shape.

Target semantics:

```text
401 → unauthenticated
403 → authenticated but forbidden action
404 → inaccessible/not-found resource
409 → stale/concurrent workflow state
422 → invalid business input
```

Never expose raw SQL/database errors.

---

# Optimistic Concurrency

Mutable workflow commands that may race should use an expected-version contract.

Do not silently overwrite another actor's update.

---

# Idempotency

Side-effecting commands that may be retried must have a defined idempotency strategy.

High-value examples:

```text
student import commit
registration submission
schedule publication
result-run request
result publication
PDF generation
```

---

# D1 Contract Freeze Checklist

Before parallel D1 coding starts, both developers must agree on:

- [ ] Role enum strategy
- [ ] Academic IDs and relationships
- [ ] Student import input shape
- [ ] Registration states
- [ ] Exam states
- [ ] Eligibility result shape
- [ ] API error envelope
- [ ] Optimistic version field
- [ ] Result rule schema
- [ ] Scheduling entity IDs
- [ ] Migration owner
- [ ] Contract owner
