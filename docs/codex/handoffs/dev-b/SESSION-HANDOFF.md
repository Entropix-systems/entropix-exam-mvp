# SESSION HANDOFF - DEV B

Last updated: 2026-09-14
Branch: `feat/B04-student-portal-documents`
Base: `eea1b18` (`integration`, includes merged B03)
Head: `eea1b18` plus uncommitted B04 working-tree changes

## Current Sprint Goal

Deliver the Tuesday demo's authenticated student closeout journey: own approved
registration, current published timetable/seat, printable admit card, current
published result, and eligible printable grade card.

## Current Task

Task: B04 - Student Portal, Admit Card & Grade Card
Status: IMPLEMENTED AND FOCUSED-VERIFIED; REVIEW/COMMIT/MERGE PENDING

The student workflow now:

1. Resolves tenant and Student exclusively from the verified active membership.
2. Returns only the caller's approved registrations through `/api/v1/me/*`.
3. Returns timetable/hall/seat only while the schedule remains published and
   complete for that registration.
4. Binds the current printable admit-card issue ID to registration ID plus
   `Exam.scheduleRevision`; schedule editing removes access until republished.
5. Returns result data only from the active current publication and only while
   the student's registration remains approved.
6. Returns a dedicated WITHHELD hold-message response with no items, components,
   percentages, GPA, credits, or grade-card reference.
7. Allows PASS, FAIL, and ABSENT to render a grade card from the immutable
   `StudentResult`/`ResultItem` snapshot, with ABSENT never displayed as zero.
8. Uses one-page printable HTML previews; no public URL or stored artifact is
   created for the demo.

## Portal UI

- Student sessions land on the mockup-aligned student workspace at `/student`
  (and the authenticated root) with `Student portal` navigation.
- The page shows verified institution/student/cohort identity, registration,
  subjects, first paper, hall/seat, full local-time timetable, and current result.
- Admit and grade previews include stable issue IDs and authoritative schedule or
  publication versions. Print CSS isolates the document from the application
  shell and produces one-page output in the focused browser check.
- Existing student directory and exam/registration navigation remains available
  so the A03 registration journey is not hidden.

## Shared Contracts / Schema

Schema / migration:

- NONE. Existing approved Registration, schedule state/revision, seat assignment,
  immutable result snapshots, and current Publication are sufficient.
- Migration lock is available; B04 does not acquire it.

Typed contracts:

- `packages/contracts/src/student-portal.ts` adds own-registration,
  own-timetable, own-published-result, current-document metadata, and aggregate
  portal DTOs.
- `CurrentStudentResultRecord` is now a discriminated union so the legacy B03
  student result route also returns only a hold message for WITHHELD.
- `docs/codex/CONTRACTS.md` records the `/api/v1/me/*` authority, visibility,
  invalidation, and printable-document rules.
- Shared contract lock: Developer B for B04 until reviewed and merged.

## Main Files

- `packages/contracts/src/student-portal.ts`
- `packages/contracts/src/results.ts`
- `apps/api/src/modules/documents/`
- `apps/api/src/modules/results/results.repository.ts`
- `apps/api/scripts/student-portal-smoke.ts`
- `apps/web/src/student-portal/`
- `apps/web/src/pages/student-portal-page.tsx`
- `apps/web/src/pages/results-page.tsx`
- `apps/web/src/pages/workspace-shell.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/App.css`
- `docs/codex/CONTRACTS.md`
- `docs/codex/CURRENT-STATE.md`
- `README.md` and package scripts

## Verification Evidence

- `pnpm verify:b04` -> PASS: contracts build; 13 focused API portal/result tests;
  4 focused Web navigation/client tests; API/Web typechecks; API/Web lint.
- `pnpm --filter @entropix/api build` -> PASS.
- `pnpm --filter @entropix/web build` -> PASS; student portal remains a lazy
  route chunk and all production chunks remain under 500 kB.
- API startup -> PASS; all five `/api/v1/me/*` routes mapped.
- Local live HTTP gate -> health 200; unauthenticated student portal read 401.
- `pnpm smoke:student-portal` -> PASS against the configured database using the
  restricted tenant transaction: one Northstar student was resolved from their
  membership and only their approved registration was returned.
- `PORTAL_SMOKE_TENANT_SLUG=cedar-school pnpm smoke:student-portal` -> PASS for
  two scoped Cedar students; Student 03 has one approved registration, one
  published timetable with three papers, and no current result.
- Browser render/print check -> PASS using local response fixtures because no
  demo login credential is stored in the repository: portal survives reload,
  shows revision 3 / publication v2 data, has no Vite overlay/page errors, and
  produces one-page admit and grade PDF output with issue/version metadata.
- Real browser/API check -> PASS for Cedar Student 03 after provisioning the
  fictional account through the one-time password-reset workflow. Login,
  refresh-cookie restoration, own approved registration, all three timetable
  rows, Hall A seat 03, admit-card preview, and logout work with no page error or
  Vite overlay. The real admit-card PDF is one page and includes schedule
  revision 1 plus its stable issue ID. No credential was written to Git.

## Actual Shared-Demo Data State

The configured shared database gives the scoped Cedar Student 03 one approved
registration, a published three-paper timetable for 15-17 September 2026, and a
current admit card. It has no current publication. Read-only result readiness
reports 63 incomplete conduct items and three unapproved marks batches. The
student credential was created through the normal reset-token workflow; no exam,
conduct, marks, result, or publication record was bypassed or directly patched.

## Known Limitations / Deferred

- Printable HTML is used instead of stored/generated PDFs, as allowed for the
  Tuesday demo. There is no document download endpoint or historical document
  archive.
- The portal currently presents the newest approved registration as the primary
  examination card while retaining all approved registrations in the API DTO.
- The real authenticated schedule/admit-card path passes. A real grade-card path
  remains pending completed conduct, marks submission, independent approval,
  computation, and publication.

## Blockers

Implementation is not blocked. Full shared-demo grade-card evidence is sequence-
blocked: the Cedar exam sittings are scheduled for 15-17 September 2026, and the
core conduct-window and independent-approval rules must not be bypassed.

## Next Exact Action

1. Review the `/api/v1/me/*` authorization filters and WITHHELD union change.
2. Commit/merge B04 and release the shared contract lock in `CURRENT-STATE.md`.
3. After the Cedar sitting windows, complete accepted duties, attendance,
   examiner submission, independent approval, compute, and publish through the
   normal workflow; then rerun the real student grade-card print check.
4. If a grade card must be shown before those sittings finish, obtain an explicit
   product decision for a separate historical fictional exam fixture instead of
   pre-publishing ANNUAL-2026.

## Minimal Context for the Next Session

1. `AGENTS.md`
2. this handoff
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/CONTRACTS.md` - Student Portal and Current Document section
5. `packages/contracts/src/student-portal.ts`
6. `apps/api/src/modules/documents/student-portal.repository.ts`
7. `apps/web/src/pages/student-portal-page.tsx`
