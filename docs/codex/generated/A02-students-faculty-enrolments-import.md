# A02 — Students, Faculty, Enrolments & Import

## Objective

Create real tenant-scoped Student, Faculty, and Enrolment records and a demo-ready student directory/import path so Northstar's 100 students and Cedar's smaller cohort can feed registration, scheduling, marks, and student outputs.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM is complete in another lane — link profiles to existing memberships; do not redesign identity.
- D0 fixtures and tenant/RLS helpers exist.
- Mockup reference: [docs/design/index.html — Students](../../design/index.html#students); preserve its structure, terminology, actions, and fixtures.
- Required upstream work: A01 academic masters must be merged and its IDs available.
- The frozen import columns are `roll_no,name,email,cohort_code,subject_codes`.

## Do Not Do

- Do not build an enterprise import framework, editable mapping UI, reconciliation engine, or background worker unless existing code makes it strictly simpler.
- Do not allow imports to create unknown academic codes or silently edit existing enrolments.
- Do not reread all docs; use `docs/STUDENT-IMPORT.md` only for import details.
- Do not run broad regression suites.

## Implementation Scope

Implement:

- Student, Faculty, and Enrolment persistence with tenant-safe relationships.
- Student directory/list/detail sufficient for the mockup.
- CSV preview with row-numbered validation, atomic commit, and retry safety.
- Northstar and Cedar fixture seeding through the existing fixture approach.
- Basic XLSX support only if a small existing-safe parser can be reused without delaying the CSV demo path.

Do not implement:

- Bulk update reconciliation, arbitrary column mapping, rich faculty HR data, or asynchronous import infrastructure.

## Business Rules

- Student roll number is tenant-unique; Student and Faculty bind to same-tenant memberships.
- Enrolment uniquely joins an active Student, Subject, and Cohort in one tenant.
- Unknown cohort/subject, missing/malformed fields, duplicate file rows, and existing roll numbers are errors with source row numbers.
- Any invalid row prevents the whole create import from committing; replay of a committed file creates no duplicates.

## Likely Files / Modules

Inspect first:

- `docs/STUDENT-IMPORT.md`
- `packages/db/prisma/schema.prisma`
- `packages/db/src/tenant.ts`
- `apps/api/src/modules/academics/`
- `fixtures/imports/`
- `docs/design/index.html` (`#students` only)

Likely changes:

- `packages/db/prisma/schema.prisma` and the coordinated migration
- `packages/contracts/src/` for minimum people/import DTOs
- `apps/api/src/modules/academics/`
- `apps/web/src/`
- fixture/seed scripts where needed

## Schema / Contract Impact

Schema:

- REQUIRED: Student, Faculty, Enrolment, plus the smallest durable import identity/report needed for retry safety.

Shared contracts:

- REQUIRED: directory/profile DTOs and import preview/commit result with row errors.

Use the existing locks; extend the active reviewed migration sequence rather than create a competing history.

## Acceptance

The task is complete when:

- Northstar's 100 valid students and Cedar's cohort import and appear in the real directory.
- Duplicate roll and unknown subject fixtures produce row-numbered preview errors and zero partial commits.
- Retrying a successful import creates no duplicate students/enrolments.
- Known foreign tenant IDs are denied.

## Verification

Run only:

- focused valid/invalid/retry import tests and one tenant-isolation test
- relevant API/Web/DB typecheck or build
- targeted manual `#students` import and directory flow

## Execution Instruction

Start implementation immediately after confirming A01 and the migration/contract lock state. Do not return PLAN ONLY or wait for PROCEED unless a shared-state conflict exists.

## Session Handoff

Before ending, update `docs/codex/handoffs/dev-a/SESSION-HANDOFF.md` in its existing required format. Replace stale facts; record actual verification, migration/contracts, cross-lane IDs, blockers, files to resume from, and the next exact action. Do not append a session log.
