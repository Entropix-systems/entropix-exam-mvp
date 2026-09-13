# Examination ERP — Shared Engineering Context

## Product

Entropix Systems is building an owned multi-tenant Examination ERP MVP for schools and colleges.

The MVP proves one complete written-examination cycle:

```text
institution setup
→ academic structure
→ students and enrolments
→ exam configuration
→ registration
→ timetable and halls
→ invigilator duties
→ admit cards
→ attendance and incidents
→ examiner marks
→ independent approval
→ result computation
→ publication
→ student result
→ grade card
```

The current three-day sprint is a controlled MVP/pilot implementation exercise.
It is not proof of production readiness.

---

## MVP Capability Groups

```text
M01 Institution and academics
M02 Identity and roles
M03 Students and faculty
M04 Exams and applications
M05 Timetable and halls
M06 Invigilation
M07 Documents
M08 Evaluation
M09 Results
M10 Common operations
```

These are one connected workflow, not independent demo screens.

---

## Architecture

The system uses:

```text
React + TypeScript + Vite + MUI
NestJS REST API
PostgreSQL
Prisma + reviewed SQL migrations
PostgreSQL RLS
private S3-compatible storage
background Worker
email abstraction
```

Repository:

```text
apps/web
apps/api
apps/worker

packages/contracts
packages/domain
packages/db
packages/storage
packages/notifications
```

The database is authoritative for:

```text
workflow state
tenant-owned records
result revisions
immutable result snapshots
jobs/outbox
audit history
```

---

## D0 Status

D0 created the engineering runway.

D0 includes, among other things:

```text
repository and branch strategy
runtime pinning
monorepo skeleton
React foundation
NestJS API foundation
background Worker
health checks
PostgreSQL development infrastructure
Prisma migration foundation
restricted database roles
multi-tenant foundation
PostgreSQL RLS
tenant transaction helper
adversarial tenant tests
shared contracts package
domain package
fictional acceptance fixtures
private object storage
ClamAV scanning
clean/infected validation
presigned URL support
CI gates
Supabase staging PostgreSQL validation
TLS CA handling
email abstraction
fresh-clone verification
pnpm d0:verify
d0-ready baseline tag
```

D0 did NOT complete the business MVP.

Still to implement during D1–D3:

```text
actual login/invite/reset workflows
academic master CRUD
student import
exam creation
registration
eligibility
timetable
hall allocation
invigilator assignment
attendance
incidents
question-paper business authorization
marks entry
marks approval
result computation
publication
grade-card generation
dashboard
reports
full role-aware UI
```

---

## Non-Negotiable D0 Guarantees

Never bypass these to preserve the three-day date:

1. Tenant-owned DB work uses the tenant transaction/RLS model.
2. Schema changes use migrations.
3. Shared contracts are not independently duplicated.
4. Private documents never become public URLs.
5. Pending/infected documents are not downloadable.
6. Email state remains truthful.
7. Red CI is treated as a real failure.
8. Fixtures remain fictional.
9. `d0-ready` remains immutable.
10. Feature completion requires API + scoped UI + validation + test.

---

## Pilot Fixtures

Primary development fixtures:

### Northstar College

```text
100 students
3 subjects
at least 3 faculty
college/application workflow
```

### Cedar School

```text
smaller cohort
school/auto-enrol workflow
```

Failure fixtures include:

```text
duplicate roll number
unknown subject
inactive student
rejected application
faculty with two department scopes
```

---

## Result Behaviour

The MVP supports:

```text
single final component
OR
internal + external weighted components
```

Expected result concepts include:

```text
PASS
FAIL
ABSENT
WITHHELD
```

Result computation must use deterministic decimal arithmetic.

Published outcomes are immutable snapshots.

Corrections after publication require:

```text
withdraw
→ correct
→ reapprove
→ compute new result run
→ publish new version
```

---

## Separation of Duties

The person who submits a marks batch may not approve that same batch.

Approval is a separate authorized action.

Publication is another separate controlled action.

---

## Working Rule

Repository documentation and committed contracts are authoritative.

Individual Codex/ChatGPT conversation history is not authoritative.

If account A and account B disagree, inspect:

```text
repository code
AGENTS.md
docs/codex/*
committed contracts
accepted tests
```

before proceeding.
