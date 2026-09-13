# Examination ERP — Codex Instructions

## Purpose

This repository contains the Entropix Systems Examination ERP MVP.

The repository is the authoritative source of truth for:

- implementation context
- architecture
- shared contracts
- engineering decisions
- current development state
- migrations
- acceptance criteria
- cross-developer dependencies

Chat history from any individual ChatGPT or Codex account is **not** project truth.

If information is required by another developer or agent, it must exist in Git.

---

## Required Context Before Starting a Task

Before starting any implementation task, read:

1. `AGENTS.md`
2. `docs/codex/CONTEXT.md`
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/SPRINT-3D.md`
5. `docs/codex/CONTRACTS.md`
6. `docs/codex/DECISIONS.md`
7. `docs/codex/ACCEPTANCE.md`
8. The assigned task file under `docs/codex/tasks/`

Then inspect the existing implementation relevant to the assigned task before proposing changes.

After a meaningful merge into `integration`, reread any shared context files that changed before continuing dependent work.

Chat history is supplementary only.

Repository state is authoritative.

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
    shared API contracts
    enums
    IDs
    shared DTOs

packages/domain
    pure business rules
    deterministic calculations

packages/db
    Prisma
    SQL migrations
    PostgreSQL access
    tenant-safe transactions
    RLS support

packages/storage
    private object-storage lifecycle
    quarantine / clean / generated files

packages/notifications
    email abstraction
    delivery-state handling
```

Do not introduce another architectural style without an explicit approved decision.

---

## D0 Engineering Foundation

The verified D0 foundation already provides the engineering runway for D1–D3.

It includes, among other things:

```text
repository and branch strategy
runtime version pinning
pnpm workspace
React application foundation
NestJS API foundation
background Worker
health endpoints
PostgreSQL local infrastructure
Prisma migration foundation
restricted DB roles
tenant transaction helper
PostgreSQL RLS
adversarial tenant tests
shared contracts package
domain package
fictional acceptance fixtures
private object storage
ClamAV scanning
clean/infected validation
signed URL support
email abstraction
CI
fresh-clone verification
pnpm d0:verify
d0-ready baseline tag
```

Do not rebuild these foundations unless the task specifically requires changing them.

---

## Git Rules

Stable engineering foundation tag:

```text
d0-ready
```

Shared development branch:

```text
integration
```

Do not modify the `d0-ready` tag.

Never implement directly on `integration`.

Use short-lived task branches.

Examples:

```text
d1-iam
d1-academic-masters
d1-student-import
d1-registration
d1-scheduling
d1-result-engine
```

Merge small reviewed changes back into `integration`.

`main` receives only a reviewed release candidate.

Avoid long-lived branches that accumulate unrelated changes.

---

## Branch Start Rule

Before creating a task branch:

```bash
git fetch origin
git checkout integration
git pull origin integration
git status
git rev-parse --short HEAD
```

The working tree should be clean.

Create the task branch only after confirming the correct integration baseline.

---

## Migration Lock

Only **one developer** may create or modify database migrations at a time.

Before generating or editing a migration:

1. Pull the latest `integration`.
2. Check `docs/codex/CURRENT-STATE.md`.
3. Confirm the current migration-lock owner.
4. Acquire the migration lock if available.
5. Generate exactly one reviewed migration sequence.
6. Run the required migration and tenancy verification.
7. Merge the migration through `integration`.
8. Release or transfer the migration lock.
9. All affected developers must pull/rebase before continuing dependent database work.

Never create two independent Prisma migration histories from the same baseline.

Never manually patch a database to make a demo work.

Schema changes must be represented by reviewed migrations.

---

## Shared Contract Lock

Only **one developer** modifies shared contracts at a time.

Shared contract areas include:

```text
packages/contracts
shared workflow states
shared role definitions
shared DTOs
API error shapes
cross-module IDs
shared enums
concurrency contracts
idempotency contracts
```

Before modifying shared contracts:

1. Check `docs/codex/CURRENT-STATE.md`.
2. Confirm or acquire the contract lock.
3. Identify which active lanes are affected.
4. Update documentation and typed contracts together.
5. Merge the shared change before dependent lanes continue.
6. Release or transfer the contract lock.

If another task needs a contract change while the lock is held, report the dependency instead of creating a competing definition.

Do not redefine shared statuses independently in Web, API, Worker, or domain code.

---

## Tenant Safety

Tenant-owned database operations must use the established tenant transaction model.

Do not:

```text
disable RLS
use postgres as the runtime application user
use exam_migration as the runtime application user
use exam_bootstrap as the runtime application user
use BYPASSRLS
introduce unscoped tenant queries
trust tenant IDs supplied directly by the client
```

Runtime application access must preserve the D0 RLS model.

Known foreign IDs must not allow cross-tenant access.

Missing tenant context must deny access.

Tenant-owned relationships must preserve tenant consistency.

Where applicable, use tenant-aware relationships conceptually like:

```text
(tenant_id, foreign_id)
        →
(tenant_id, id)
```

Do not weaken composite tenant integrity for ORM convenience.

---

## Database Roles

Conceptually:

```text
exam_bootstrap
    local infrastructure bootstrap only

exam_migration
    schema and migration owner

exam_app
    restricted runtime application role
```

API and Worker runtime DB access must use the restricted application role.

The runtime role must not be:

```text
superuser
database owner
schema migration owner
BYPASSRLS
```

---

## Database Changes

Every tenant-owned business table should follow the established D0 patterns where applicable:

```text
UUID primary key
tenant_id
tenant-safe relationships
tenant-scoped uniqueness
RLS ENABLED
RLS FORCED
USING policy
WITH CHECK policy
restricted runtime privileges
```

Mutable aggregates that participate in optimistic concurrency should use the shared versioning conventions.

Do not invent additional persistent entities merely because they may be useful later.

Implement only the approved task boundary.

---

## Private Documents

Documents are private.

Never create public object URLs for:

```text
question papers
admit cards
grade cards
confidential documents
student documents
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

A signed URL may be generated only after business authorization succeeds.

Do not bypass document authorization because the underlying storage URL exists.

---

## Notifications

Email delivery is not authoritative business state.

A successful business transaction must not be rolled back because email delivery fails.

Do not claim `DELIVERED` unless delivery is actually confirmed.

Expected concepts include:

```text
QUEUED
ACCEPTED
DELIVERED
FAILED
UNKNOWN
```

Email failure must remain visible and retryable where applicable.

---

## Fixtures

Use fictional development data only.

Primary fixtures include:

```text
Northstar College
Cedar School
```

Expected fixture coverage includes cases such as:

```text
duplicate roll number
unknown subject
inactive student
rejected registration/application
faculty with multiple department scopes
result boundary cases
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
tenant/role scope
+
scoped UI
+
validation
+
relevant automated tests
+
integration evidence
```

A working-looking screen alone is **not** complete.

A CRUD API alone is **not** complete.

Compilation alone is **not** complete.

A TODO/stub/demo implementation is **not** complete.

---

## Acceptance First

Business-critical changes must be evaluated against:

```text
docs/codex/ACCEPTANCE.md
```

Do not weaken acceptance criteria because implementation is difficult.

If implementation and acceptance criteria conflict, report the conflict rather than silently changing the test expectation.

---

## D0 Verification

The D0 engineering foundation must remain valid.

Use:

```bash
pnpm d0:verify
```

before risky/shared merges and at appropriate integration gates.

Existing development helpers include:

```bash
pnpm infra:up
pnpm infra:down
pnpm dev:stop
```

Do not unnecessarily run the entire verification suite after every tiny edit.

Preferred development sequence:

```text
focused test
    ↓
package test/typecheck
    ↓
integration test
    ↓
d0:verify at meaningful gate
```

---

## Codex Working Method

For substantial tasks:

1. Read required project context.
2. Inspect relevant existing code.
3. Inspect the current Git state.
4. Identify shared contract/schema dependencies.
5. Plan before editing.
6. Confirm whether migration or contract locks are required.
7. Implement the smallest complete vertical slice.
8. Run focused tests.
9. Inspect the final diff.
10. Report exact changes and remaining limitations.
11. Update shared context when required.

Do not rewrite unrelated code.

Do not opportunistically refactor unrelated modules during the three-day sprint.

Do not invent product requirements.

Do not introduce speculative infrastructure.

If requirements conflict or are unclear, stop and report the conflict.

---

## Plan-First Rule

For significant tasks, the first agent response should be **PLAN ONLY** unless the task explicitly says otherwise.

The plan should identify:

```text
current repository state
existing foundation to reuse
files/modules likely to change
schema impact
contract impact
cross-lane impact
tests
risks
blockers
```

Do not edit files until the task owner gives `PROCEED` when plan approval is required.

---

# Cross-Developer Handoff and Shared Context Protocol

The repository is the shared memory for all developers and all AI agents.

A requirement, decision, limitation, schema change, shared contract change, environment change, or cross-module dependency is **not considered communicated** merely because it exists inside one developer's ChatGPT or Codex conversation.

If another developer or agent needs to know it, record it in Git.

---

## Task Completion Protocol

Before declaring any implementation task complete:

1. Run focused tests for the changed behaviour.
2. Run package/integration tests appropriate to the change.
3. Inspect the final diff for unrelated changes.
4. Identify whether the task changed shared project truth.
5. Update the appropriate shared context files when required.
6. Produce the standard completion report.
7. Ensure implementation and documentation agree.
8. Commit only after the task is internally consistent.

A task is not complete if required knowledge exists only inside chat history.

---

## Update `CURRENT-STATE.md` When

Update:

```text
docs/codex/CURRENT-STATE.md
```

when:

- a meaningful implementation slice is completed
- an important task is merged into `integration`
- a shared dependency becomes available
- a developer changes active task or lane
- a blocker appears or is resolved
- migration-lock ownership changes
- contract-lock ownership changes
- a migration becomes available to other lanes
- a shared contract becomes available to other lanes
- the integration baseline changes in a meaningful way

Keep `CURRENT-STATE.md` concise.

It is the current operational state of the project, not a detailed engineering diary.

---

## Update `DECISIONS.md` When

Update:

```text
docs/codex/DECISIONS.md
```

when:

- an architectural decision is made
- multiple valid approaches existed and one was selected
- an earlier decision is superseded
- a cross-module behaviour is decided
- an important security decision is made
- an important data-model decision is made
- a workflow decision is made
- a concurrency strategy is selected
- an integration boundary is selected

Examples:

```text
RuleVersion belongs to Exam

RoleGrant department scope is authoritative

ExamPaper owns authoritative schedule time

eligibilitySnapshot remains internal JSON

result publication validates Exam.inputRevision
```

Do not record ordinary implementation details as architectural decisions.

---

## Decision Records

Decision entries should use a stable identifier.

Example:

```text
DEC-006 — ExamPaper Owns Schedule Time

Status: ACCEPTED

Context:
...

Decision:
...

Consequences:
...

Affected modules:
...

Related commit:
...
```

If a decision changes, do not erase the old decision.

Mark it:

```text
SUPERSEDED
```

and reference the replacement decision.

---

## Update `CONTRACTS.md` When

Update:

```text
docs/codex/CONTRACTS.md
```

and the corresponding typed implementation when:

- a shared enum changes
- workflow states change
- an API DTO changes
- API error semantics change
- a shared identifier/reference contract changes
- concurrency conventions change
- idempotency conventions change
- authorization context changes
- another module must consume a new shared interface

Documentation and typed contracts must not contradict each other.

---

## Schema and Migration Changes

When a task introduces or changes shared database structure:

- update the Prisma/schema source
- create a reviewed migration
- preserve tenant-safe relationships
- preserve RLS
- preserve runtime role restrictions
- update `CURRENT-STATE.md` if other lanes depend on the migration
- record migration-lock ownership appropriately
- report the migration explicitly in the completion report

Never communicate a schema dependency only through chat.

---

## Local Development / Environment Changes

If a task introduces:

- a new required environment variable
- a new container or local service
- a new setup step
- a new external dependency
- a changed developer command
- a changed local port
- a new cloud/staging requirement

then update the appropriate repository onboarding/setup documentation and:

```text
.env.example
```

where applicable.

Never commit secrets.

---

## Acceptance Changes

Update:

```text
docs/codex/ACCEPTANCE.md
```

only when an approved product or engineering decision changes a business-critical acceptance scenario or expected assertion.

Do not change acceptance criteria merely to make existing implementation pass.

---

## Main / Cross-Lane Changes

A **MAIN CHANGE** is any change that can affect another active developer, task, or module.

Examples:

```text
database schema
migration history
shared contracts
authentication context
authorization behaviour
tenant model
workflow states
API response contracts
shared domain logic
environment/configuration
shared UI shell
job/outbox behaviour
document security behaviour
result rules
shared identifiers
runtime/deployment commands
```

For a MAIN CHANGE:

1. Record the change in the appropriate shared repository file.
2. State which lanes/modules are affected.
3. Coordinate migration/contract locks if applicable.
4. Merge the shared change through `integration`.
5. Notify affected developers through the repository handoff.
6. Affected developers pull/rebase onto the new integration state.
7. Their AI agents reread the changed shared context.
8. Dependent work continues only after resynchronization.

---

## Cross-Lane Dependency Rule

If one developer discovers something another lane must consume:

Do not create a private workaround.

Instead:

1. Identify the dependency.
2. Determine whether it affects contracts, schema, decisions, environment, or shared domain behaviour.
3. Coordinate the appropriate lock if required.
4. Record the shared change in Git.
5. Merge the shared dependency first.
6. Affected developers resync.
7. Continue dependent implementation.

Examples:

```text
IAM introduces ActorContext required by Academic APIs

Academic work requires a new Membership scope

Scheduling introduces a shared ExamPaper identifier

Results require Exam.inputRevision

Student import requires a new shared validation contract
```

---

## Conflict Rule

If active developers need incompatible changes to the same shared area:

```text
STOP
```

Do not let both branches independently implement competing versions.

Resolve the shared decision first.

Then:

```text
shared decision/contract/schema
        ↓
integration
        ↓
all affected branches resync
        ↓
parallel development resumes
```

---

## Post-Merge Synchronization

After a meaningful shared change is merged into `integration`, affected developers should run:

```bash
git fetch origin
git checkout integration
git pull origin integration
git status
git rev-parse --short HEAD
```

Then update or rebase their active feature branch according to the team's chosen Git workflow.

Do not continue dependent implementation using an obsolete shared baseline.

---

## AI Agent Context Refresh

Start a new engineering session, or refresh after a significant integration update, by reading:

1. `AGENTS.md`
2. `docs/codex/CONTEXT.md`
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/CONTRACTS.md`
5. `docs/codex/DECISIONS.md`
6. `docs/codex/ACCEPTANCE.md`
7. the assigned task file

Then inspect only the implementation modules relevant to the current task.

Do not depend on previous chat history as project truth.

---

## Context Refresh After Shared Merge

If another developer merges a MAIN CHANGE affecting the active task:

1. Pull/rebase the new integration state.
2. Read the changed shared documentation.
3. Inspect the shared code/schema/contract change.
4. Re-evaluate the current task plan.
5. Report any newly introduced conflict before continuing.

Do not blindly continue a previously generated Codex plan after its assumptions have changed.

---

## Shared Context Must Stay Minimal

Shared context documents should contain information another developer or agent needs.

Do not fill shared files with:

```text
long debugging transcripts
full chat transcripts
temporary thoughts
irrelevant implementation notes
agent reasoning
copied terminal output that has no lasting value
```

Prefer concise facts:

```text
what changed
why
current state
contract
decision
dependency
required action
```

---

## Definition of Complete Handoff

```text
implementation
+
tests
+
shared-context update when required
+
cross-lane impact recorded
+
reviewable commit
+
required handoff action identified
=
TASK COMPLETE
```

Chat history alone never satisfies the handoff requirement.

---

# Standard Task Completion Report

At the end of every implementation task, report:

```text
LANE:
TASK:
BRANCH:
BASE SHA:
HEAD SHA:

Implemented:
- ...

Files changed:
- ...

Schema / migration changes:
- NONE
or
- ...

Shared contract changes:
- NONE
or
- ...

Decisions introduced:
- NONE
or
- DEC-XXX ...

Environment / setup changes:
- NONE
or
- ...

Cross-lane impact:
- NONE
or
- ...

Tests executed:
- command → PASS/FAIL
- command → PASS/FAIL

Acceptance criteria:
- PASS/FAIL ...

Known limitations:
- ...

Shared context files updated:
- NONE
or
- docs/codex/CURRENT-STATE.md
- docs/codex/DECISIONS.md
- docs/codex/CONTRACTS.md
- docs/codex/ACCEPTANCE.md
- setup documentation

Ready to merge:
- YES / NO

Required action for other developers after merge:
- NONE
or
- pull latest integration
- rebase active branch
- consume contract X
- apply migration Y
- add environment variable Z
- reread decision DEC-XXX
- rerun test command X
```

Do not mark a task ready to merge when a required shared-context update is missing.

---

## Completion Report Accuracy

The completion report must describe the actual final repository state.

Do not claim:

```text
implemented
tested
complete
production-ready
migration verified
accepted
```

unless the corresponding implementation or evidence exists.

Explicitly report incomplete work.

---

## Review Before Merge

Before requesting merge:

```bash
git status
git diff --check
git diff <base>...HEAD
```

Confirm:

- no unrelated files changed
- no secrets were introduced
- generated artifacts are expected
- migrations are intentional
- shared-context updates are present when required
- relevant tests passed
- no temporary debugging code remains

---

## Merge Readiness

A branch is merge-ready only when:

```text
scope complete
+
tests pass
+
shared contracts consistent
+
migration state valid
+
cross-lane impact documented
+
shared context current
+
diff reviewed
```

If any required item is unresolved:

```text
Ready to merge: NO
```

---

## Final Engineering Principle

The project must remain understandable and resumable from the repository alone.

At any point, a developer using a fresh laptop and a fresh ChatGPT/Codex session should be able to:

```text
clone repository
        ↓
read AGENTS.md + docs/codex/*
        ↓
inspect CURRENT-STATE
        ↓
understand architecture and decisions
        ↓
identify their assigned task
        ↓
know current locks/dependencies
        ↓
continue implementation safely
```

If that is not possible, project context has not been captured correctly.