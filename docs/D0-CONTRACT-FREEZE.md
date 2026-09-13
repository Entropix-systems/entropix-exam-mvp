# Examination ERP MVP — D0 Contract Freeze

Status: FROZEN FOR THE THREE-DAY MVP

## Shared role bundles

- PLATFORM_ADMIN
- INSTITUTION_ADMIN
- EXAM_CONTROLLER
- DEPARTMENT_ADMIN
- FACULTY
- INVIGILATOR
- STUDENT
- AUDITOR

D1 IAM alignment replaces the former combined faculty/examiner and invigilator/observer names.
HOD = DEPARTMENT_ADMIN with department scope; EXAMINER = FACULTY with evaluation assignment;
OBSERVER = INVIGILATOR with duty assignment. These are not additional canonical roles.
Department/HOD scope and assignment scope further restrict access.

## Registration

Modes:
- AUTO_ENROL
- APPLICATION

States:
- DRAFT
- SUBMITTED
- APPROVED
- REJECTED
- CANCELLED

## Exam

States:
- DRAFT
- REGISTRATION_OPEN
- PREPARATION
- SCHEDULE_PUBLISHED
- EVALUATION
- PUBLISHED
- CANCELLED

There is no separate CONDUCT exam state in the frozen MVP contract.

## Attendance

- NOT_MARKED
- PRESENT
- ABSENT
- LATE

LATE counts as attended.

## Evaluation

Components:
- FINAL
- INTERNAL
- EXTERNAL

Marks batch:
- DRAFT
- SUBMITTED
- APPROVED
- RETURNED

Submitter and approver must be different users.

## Result outcomes

- PASS
- FAIL
- ABSENT
- WITHHELD

Incomplete inputs block computation/publication and are not a published result outcome.

## API

Base path:
- /api/v1

Success:
- data
- requestId

Error:
- code
- message
- fieldErrors
- requestId

HTTP semantics:
- 401 unauthenticated
- 403 forbidden
- 404 inaccessible resource
- 409 stale/concurrent/idempotency conflict
- 422 invalid business input

Cursor page size:
- maximum 100

## Concurrency

PATCH commands require expectedVersion.

Authenticated business/admin side-effecting POST commands require Idempotency-Key.
D1 IAM protocol exception: login, refresh, logout, forgot-password, reset-password,
and invitation acceptance use transactional token/session semantics, not this header.
Never replay a cached refresh-rotation response.

Idempotency keys are scoped to:
- tenant
- actor
- operation

Request hash and result are retained for 24 hours.
A reused key with a different request body returns 409.

## Change control

No engineer creates a second role/state/result/error representation inside an application module.

Any change to a frozen shared contract requires review by the technical lead and must update:
1. packages/contracts
2. relevant database/domain contract
3. fixture/test expectations
4. API/UI behaviour
