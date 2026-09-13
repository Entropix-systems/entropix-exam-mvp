# A01 — Academic Masters

## Objective

Deliver persisted, tenant-scoped academic masters for Northstar College and Cedar School so the Setup & access screen and downstream enrolment/exam flows use real Campus, Department, Program, AcademicYear, Term, Cohort, and Subject records.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM is complete in another lane — reuse its actor/tenant context when available; do not modify it.
- D0 is complete — reuse Prisma, tenant transactions, RLS patterns, API envelopes, and fixtures.
- Mockup reference: [docs/design/index.html — Setup & access](../../design/index.html#setup); preserve its structure, terminology, and Northstar/Cedar fixtures.
- `AcademicsModule` is currently an empty shell; the Prisma schema has no academic entities; the web app is the Vite starter.
- Required upstream work: migration-lock coordination; no business feature dependency.

## Do Not Do

- Do not rebuild IAM, D0 infrastructure, or tenant provisioning.
- Do not reread all project docs; consult only the academic model section if this prompt conflicts with code.
- Do not add speculative masters, generic metadata frameworks, or unrelated refactors.
- Do not run the full repository verification suite.

## Implementation Scope

Implement:

- Tenant-safe models and one reviewed migration for Campus, Department, Program, AcademicYear, Term, Cohort, and Subject.
- Same-tenant relationships, tenant-scoped codes, required date/order validation, and RLS using existing patterns.
- Minimal CRUD/query API under `/api/v1` with server-derived tenant scope and standard envelopes.
- Setup UI using persisted data for the two fictional tenants.

Do not implement:

- Student/faculty records, exams, scheduling, custom fields, deletion of referenced history, or advanced setup workflows.

## Business Rules

- Hierarchy is Tenant → Campus → Department → Program → Term → Cohort; AcademicYear also owns Term; Subject belongs to Program.
- IDs are UUIDs, codes are unique within the correct tenant/parent scope, and cross-tenant foreign IDs are inaccessible.
- Academic-year dates are ordered; term belongs to the same tenant/program/year.
- Preserve Northstar College and Cedar School terminology and fixtures.

## Likely Files / Modules

Inspect first:

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260911063050_identity_tenancy_rls/migration.sql`
- `packages/db/src/tenant.ts`
- `apps/api/src/modules/academics/academics.module.ts`
- `apps/web/src/App.tsx`
- `docs/design/index.html` (`#setup` only)

Likely changes:

- `packages/db/prisma/schema.prisma` and one migration
- `packages/contracts/src/` for the minimum academic IDs/DTOs
- `apps/api/src/modules/academics/`
- `apps/web/src/`
- existing fictional fixture/seed path

## Schema / Contract Impact

Schema:

- REQUIRED: the seven tenant-owned academic entities, composite tenant-safe relationships, uniqueness, constraints, RLS, and restricted runtime grants.

Shared contracts:

- REQUIRED only for academic IDs and request/response DTOs consumed by Web and later tasks.

Use the AGENTS.md migration and contract lock protocol. The handoff records migration lock as DEV B and contract lock as DEV A; coordinate before editing shared state.

## Acceptance

The task is complete when:

- Northstar and Cedar academic structures persist and reload through UI → API → database.
- A foreign tenant ID cannot read or mutate an academic record.
- Invalid hierarchy/date/code input is rejected with the standard API error shape.
- Downstream tasks can reference stable Term, Cohort, and Subject UUIDs.

## Verification

Run only:

- focused academic API/model tests, including one cross-tenant denial
- relevant API/Web/DB typecheck or build
- targeted manual `#setup` flow for both fixtures

## Execution Instruction

Start implementation immediately on a short-lived task branch. Do not return PLAN ONLY or wait for PROCEED unless the migration/contract lock cannot be safely coordinated.

## Session Handoff

Before ending, replace stale facts in `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md` using its existing required headings. Record usable behavior, exact verification, migration/contract state, cross-lane consequences, relevant files, blockers, and the next exact action. Do not append a diary.
