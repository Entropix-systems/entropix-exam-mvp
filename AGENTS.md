# Examination ERP — Codex Instructions

## Purpose

This repository contains the Entropix Systems Examination ERP MVP.

The repository is the source of truth for implementation context.
Chat history from any individual ChatGPT/Codex account is NOT project truth.

Before starting any implementation task, read:

1. `AGENTS.md`
2. `docs/codex/CONTEXT.md`
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/SPRINT-3D.md`
5. The assigned task file under `docs/codex/tasks/`

Also inspect the existing implementation relevant to the task before proposing changes.

---

## Architecture

The MVP uses a modular monolith.

Repository shape:

```text
apps/
├── web
├── api
└── worker

packages/
├── contracts
├── domain
├── db
├── storage
└── notifications
```

Runtime responsibilities:

```text
apps/web
    React browser application

apps/api
    NestJS REST API
    synchronous domain commands and queries

apps/worker
    imports
    PDF generation
    result computation
    notification retries

packages/contracts
    shared API contracts, enums and IDs

packages/domain
    pure business rules

packages/db
    Prisma, SQL migrations and tenant-safe DB access

packages/storage
    private object-storage lifecycle

packages/notifications
    email abstraction and delivery state
```

---

## Git Rules

Stable foundation tag:

```text
d0-ready
```

Shared development branch:

```text
integration
```

Never implement directly on `integration`.

Use short-lived task branches.

Examples:

```text
d1-a-auth
d1-a-scheduling-foundation
d1-b-student-import
d1-b-registration
d1-b-result-engine
```

Merge small reviewed changes back into `integration`.

`main` receives only a reviewed release candidate.

---

## Migration Lock

Only ONE developer may create or modify database migrations at a time.

Before generating a migration:

1. Pull latest `integration`.
2. Confirm who owns the migration lock.
3. Generate exactly one reviewed migration sequence.
4. Merge it.
5. Other developer rebases/pulls before continuing DB work.

Never create two independent Prisma migration histories from the same baseline.

Never manually modify a database to make a demo work.

Schema changes must be represented by migrations.

---

## Shared Contract Lock

Only ONE developer modifies shared contracts at a time.

Shared contract areas include:

```text
packages/contracts
shared workflow states
shared role definitions
API DTOs
API error shapes
cross-module IDs
shared enums
```

If another task needs a contract change while the lock is held, record the requested change and coordinate first.

Do not redefine shared statuses separately in Web and API.

---

## Tenant Safety

Tenant-owned database operations must use the established tenant transaction model.

Do not:

```text
disable RLS
use postgres as the runtime user
use exam_migration as the runtime user
use exam_bootstrap as the runtime user
introduce unscoped tenant queries
```

Runtime application access must preserve the D0 RLS model.

Known foreign IDs must not allow cross-tenant access.

Missing tenant context must deny access.

---

## Database Roles

Conceptually:

```text
exam_bootstrap
    local infrastructure bootstrap only

exam_migration
    schema migration owner

exam_app
    runtime application role
```

API and Worker runtime DB access must use the restricted application role.

---

## Private Documents

Documents are private.

Never create public object URLs for:

```text
question papers
admit cards
grade cards
confidential documents
```

Expected lifecycle:

```text
upload
  ↓
quarantine
  ↓
scan
  ↓
CLEAN
  ↓
business authorization
  ↓
availability-window check
  ↓
audit
  ↓
short-lived signed URL
```

PENDING or INFECTED documents must not be downloadable.

A signed URL is generated only after business authorization succeeds.

---

## Notifications

Email delivery is not authoritative business state.

A successful business transaction must not be rolled back because email delivery fails.

Do not claim DELIVERED unless delivery is actually confirmed.

Expected concepts include:

```text
QUEUED
ACCEPTED
DELIVERED
FAILED
UNKNOWN
```

---

## Fixtures

Use fictional development data only.

Primary fixtures include:

```text
Northstar College
Cedar School
```

Do not use real student or institution data during MVP development.

---

## Quality Rules

Feature completion means:

```text
database/domain behaviour
+
working API
+
scoped UI
+
validation
+
relevant automated test
```

A working-looking screen alone is NOT complete.

A CRUD API alone is NOT complete.

Compilation alone is NOT complete.

---

## D0 Verification

The D0 engineering foundation must remain valid.

Use:

```bash
pnpm d0:verify
```

before risky merges and at appropriate integration gates.

Existing development helpers include:

```bash
pnpm infra:up
pnpm infra:down
pnpm dev:stop
```

Do not modify the `d0-ready` tag.

---

## Codex Working Method

For substantial tasks:

1. Read required context.
2. Inspect relevant existing code.
3. Plan before editing.
4. Identify shared contracts/migrations that may change.
5. Implement the smallest complete vertical slice.
6. Run focused tests.
7. Report exact changes and remaining limitations.

Do not rewrite unrelated code.

Do not opportunistically refactor unrelated modules during the three-day sprint.

Do not invent product requirements.

If requirements conflict or are unclear, stop and identify the conflict.

---

## Completion Report

At the end of every Codex task report:

```text
Task:
Branch:

Implemented:
- ...

Files changed:
- ...

Contracts changed:
- ...

Migrations:
- ...

Tests executed:
- ...

Acceptance criteria:
- PASS/FAIL ...

Known limitations:
- ...

Recommended next step:
- ...
```
