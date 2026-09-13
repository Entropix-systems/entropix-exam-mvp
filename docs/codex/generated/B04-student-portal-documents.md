# B04 — Student Portal, Admit Card & Grade Card

## Objective

Connect the mock student portal to real scoped state so an authenticated student can see only their approved registration, published timetable/seat, current admit card, current published result, and eligible grade card.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM is complete in another lane — resolve the student from authenticated context, never from a client-supplied student ID.
- D0 private storage, scanner, and signed URL foundation exists; reuse it where a file is needed.
- Mockup reference: [docs/design/index.html — Student portal](../../design/index.html#student); preserve its portal structure, terminology, statuses, printable outputs, and fixtures.
- Required upstream work: A03 registration, A04 schedule/seat/revision, and B03 current publication/result snapshot.
- `DocumentsModule` is empty and the web app has no portal implementation.

## Do Not Do

- Do not expose another student's records, question papers, draft/withdrawn results, or held numeric data.
- Do not make generated documents public or bypass CLEAN/business authorization checks.
- Do not build a sophisticated document pipeline; printable HTML is acceptable for Tuesday.
- Do not reread all docs or run the full suite.

## Implementation Scope

Implement:

- `/api/v1/me` reads for own registration, timetable, hall/seat, current published result, and current document metadata.
- Mockup-aligned Student portal UI with printable admit card and grade card.
- Persisted current document/version metadata only where needed to invalidate prior schedule/publication versions.
- Simple PDF generation only if the existing foundation makes it faster than printable HTML.

Do not implement:

- Public links, batch document studio, advanced templates, postal delivery, or question-paper access.

## Business Rules

- Student identity and tenant come from verified server context; changing a URL cannot select another student.
- Admit card requires approved registration and published schedule and includes schedule revision, issue ID, local times, hall, and seat.
- Only an active current publication is result-visible; WITHHELD shows only a hold message and has no grade card.
- PASS, FAIL, and ABSENT may have a clearly labelled grade card from immutable StudentResult snapshot data.
- Withdrawal/schedule revision stops new access to the old current document reference.

## Likely Files / Modules

Inspect first:

- A03 registration read code
- A04 schedule/seat/revision code
- B03 current-publication/student-result code
- `apps/api/src/modules/documents/documents.module.ts`
- `packages/storage/src/`
- `docs/design/index.html` (`#student` only)

Likely changes:

- `apps/api/src/modules/documents/` and/or student-facing query controllers
- `apps/web/src/`
- schema only for minimal DocumentVersion/current-reference metadata if still absent

## Schema / Contract Impact

Schema:

- CONDITIONAL: add only the minimal tenant-owned document version/current binding needed for real invalidation; printable HTML without stored artifacts may require no new table.

Shared contracts:

- REQUIRED: own-registration, own-schedule, own-published-result, and document metadata DTOs; no arbitrary studentId input.

Use the existing locks if schema/contracts change.

## Acceptance

The task is complete when:

- The demo student sees their own real registration, schedule, hall/seat, admit card, and published result after reload.
- Draft/withdrawn results and another student's records are denied/not found.
- WITHHELD reveals no components, percentage, GPA, or grade card.
- Admit/grade output includes the current revision/version and becomes stale after withdrawal/revision.

## Verification

Run only:

- focused own/other student authorization, unpublished/withdrawn, WITHHELD, and current-document tests
- relevant API/Web typecheck or build
- targeted student `#student` manual flow, including print output

## Execution Instruction

Start implementation immediately after A03/A04/B03 are available. Do not return PLAN ONLY or wait for PROCEED unless a shared document/current-version contract conflicts.

## Session Handoff

Before ending, update `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md` in its existing required format. Record actual portal visibility, document approach, verification, contracts/schema, limitations, blockers, files, and next action; remove stale facts.
