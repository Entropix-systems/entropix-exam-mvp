# SESSION HANDOFF — DEV A

Last updated: 2026-09-14
Branch: `feat/masters-ui`
Source commit: `48dac03`
Integration base: `48dac03`

## Current Sprint Goal

Working Examination ERP demo for Tuesday. Academic masters now have a dedicated
Institution Admin UI backed by the existing tenant-scoped A01 API.

## Current Task

Task: Academic Masters management UI
Status: IMPLEMENTED IN WORKTREE; NOT COMMITTED

## Implemented

- Added `/masters` as a dedicated Institution Admin screen using the existing
  academic snapshot, create and update endpoints.
- Exposed Campus, Department, Program, Academic Year, Term, Cohort and Subject
  as selectable master categories with persisted record counts and tables.
- Added minimal create/edit forms with the required hierarchy selectors, dates,
  term sequence and subject credits. API validation remains authoritative.
- Added an Institution Admin-only `Academic masters` navigation item.
- Removed the academic summary/listing from Setup & access and deleted its
  obsolete UI component and focused rendering test.
- Kept the current theme and responsive layout. No delete or custom-field UI was
  introduced.

## Stable Contracts / IDs

- No shared contract changes. The UI reuses `AcademicStructureSnapshot`,
  `AcademicInputByResource`, `AcademicRecordByResource` and
  `AcademicResourcePath` from `packages/contracts/src/academics.ts`.
- Persisted UUIDs and the existing server-derived tenant scope are unchanged.

## Migration / Locks

- Schema/migration changes: NONE.
- Shared contract changes: NONE.
- No migration or shared-contract lock was required.

## Demo Data

- Existing Northstar College and Cedar School academic seed records are shown by
  the new screen through `GET /api/v1/academics`.
- Create/edit actions use the existing POST/PUT API and persist to the current
  tenant database.

## Verification

- `pnpm --filter @entropix/web typecheck`: PASS.
- `pnpm --filter @entropix/web test`: PASS, 19 tests.
- `pnpm --filter @entropix/web build`: PASS.
- `pnpm --filter @entropix/web lint`: PASS.
- `git diff --check`: PASS.
- React best-practices focused review: PASS; data loads once, mutations reload
  the snapshot, role gating is derived, and form labels/dialog semantics remain
  explicit.
- Authenticated browser/database mutation proof: NOT RUN; no repository-managed
  demo credential is available.
- Broad `pnpm d0:verify`: NOT RUN per sprint instructions.

## Limitations / Blockers

- Delete remains intentionally unsupported by the A01 API.
- Master types and fields are fixed by the current shared schema; this is not a
  generic custom-metadata builder.
- The worktree already contained an unrelated modification to
  `packages/contracts/src/duties.ts`; it was preserved and not included in this
  task.
- No implementation blocker remains.

## Relevant Files

- `apps/web/src/pages/masters-page.tsx`
- `apps/web/src/pages/workspace-shell.tsx`
- `apps/web/src/pages/setup-access-page.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/App.css`

## Next Exact Action

1. Sign in as a fictional Northstar or Cedar Institution Admin and open
   `/masters` for the optional final demo smoke check.
2. Commit only the Masters UI and handoff files; do not include the unrelated
   `packages/contracts/src/duties.ts` work.
