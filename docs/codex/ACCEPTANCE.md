# MVP Acceptance Reference

Acceptance prioritizes expensive failure modes and the complete examination journey.

---

## A01 Tenant Isolation

Known foreign IDs must not allow:

```text
read
write
search
export
download
```

Missing tenant context must deny.

---

## A02 Assignment Scoping

Students see only their own student records.

Examiner/invigilator access is limited to assigned resources.

---

## A03 Tenant Pool Reuse

Tenant context must not leak between sequential or concurrent transactions.

---

## A04 Import Integrity

Malformed/duplicate imports must reconcile correctly.

Invalid atomic batches must not partially commit.

Retry must not duplicate valid records.

---

## A05 Registration Window and Eligibility

Closed window and inactive/ineligible enrolment must reject.

Approval retains the eligibility decision snapshot.

---

## A06 Scheduling Concurrency

Concurrent scheduling must not double-book:

```text
student
seat
room
invigilator
```

---

## A07 Attendance and Incidents

```text
NOT_MARKED blocks close.
ABSENT is distinct from zero.
Result hold hides numeric result.
```

---

## A08 Marks and Approval

Reject:

```text
out-of-range marks
stale updates
self approval
```

Return/reopen must preserve history.

---

## A09 Result Boundaries

Reference fixtures include:

```text
74 → PASS / B
54 total with failed component threshold → FAIL
39.995 raw with threshold 40 → FAIL although display may round 40.00
GPA example → 8.20
```

---

## A10 Result Revision Race

A marks/hold change during computation invalidates the candidate result run.

A stale run must not publish.

---

## A11 Publication Retry and Withdrawal

Only one active publication.

Retry must not create duplicate publication.

Withdrawn result/download must stop being current.

New publication version becomes current.

---

## A12 Private Documents

Deny download when:

```text
PENDING scan
INFECTED
outside access window
unassigned user
unauthorized role
```

Signed URLs expire.

---

## A13 Worker Recovery

Expired job lease can resume.

Business-key uniqueness prevents duplicate current output.

---

## A14 Account Revocation

Password reset, suspension and refresh-token replay protection prevent continued access.

---

## A15 Recovery

Restore database and referenced objects.

Verify:

```text
record counts
files
current publication
```

---

# Test Layers

Use:

```text
pure unit tests
    result arithmetic and rule behaviour

real PostgreSQL integration tests
    RLS
    transactions
    constraints
    concurrency

browser end-to-end tests
    one complete school path
    one complete college path
```

Static prototype behaviour is not acceptance evidence.
