# SESSION HANDOFF - DEV B

Last updated: 2026-09-14
Branch: `feat/FULL-APPLICATION-demo-seed-and-flow-test`
Base: `origin/integration` at `1d7ed58`
Starting HEAD: `ecbf2ec`

## Current Task

Task: Full Application Demo Seed, Role Credentials & End-to-End Flow Test
Status: IMPLEMENTED AND VERIFIED ON DISPOSABLE LOCAL POSTGRESQL; REVIEW/MERGE PENDING

This gate makes IAM plus A01-A05 and B01-B04 reproducible before B05. It adds
historical completed exams without changing Cedar's future `ANNUAL-2026`
schedule, provisions fictional role credentials through the real reset path,
and verifies server-resolved role access plus student documents.

## Commands

```bash
pnpm seed:demo:full-application
pnpm smoke:demo:full-application
pnpm test:demo:roles
pnpm test:demo:journey
```

The seed defaults to local PostgreSQL and refuses production. A non-local
fictional shared demo additionally requires both:

```bash
DEMO_SEED_TARGET=shared DEMO_SEED_ACK=<exact-database-name> \
  pnpm seed:demo:full-application
```

The shared target was not applied or verified in this task.

## Seeded Journeys

```text
CEDAR-HIST-2026
  20 students
  PASS 18 / ABSENT 1 / WITHHELD 1
  three published historical sittings and 60 exact seats
  accepted duties and submitted attendance
  three independently approved marks batches
  exactly one current publication

NORTHSTAR-HIST-2026
  two approved students plus one rejected application fixture
  PASS 1 / FAIL 1
  three published historical sittings and six exact seats
  accepted duties and submitted attendance
  three independently approved marks batches
  exactly one current publication
```

Cedar `ANNUAL-2026` remains schedule revision 1 with its three 15-17 September
2026 sittings and existing hall/seat/admit-card behavior.

## Credentials and Bulk Imports

- Shared fictional role reference:
  `docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md`
- 13 usable role/student credentials and one expected suspended denial are
  provisioned through the real reset/password-hashing workflow.
- Bulk CSV pack: `fixtures/imports/bulk/`
  - clean 12-row Northstar upload
  - clean 12-row Cedar upload
  - seven-row negative/reconciliation preview file
- The original 100-row Northstar and 20-row Cedar CSVs remain the baseline seed
  fixtures; the upload pack is not auto-committed into the authoritative roster.

## Browser Evidence

Eight screenshots and their index live under
`docs/codex/evidence/full-application-demo/`. They cover:

1. Cedar Student 03 PASS portal.
2. Historical admit card.
3. One-page grade card.
4. Controller future timetable/hall allocation.
5. Controller historical result publication.
6. Assigned faculty marks.
7. Invigilator duty/submitted attendance.
8. Cedar Student 02 WITHHELD privacy.

The browser used real API authentication. The final console had no page or Vite
errors. No screenshots contain credentials, tokens, cookies, database details,
or developer tooling.

## Verification

- Full seed on disposable local PostgreSQL -> PASS.
- Identical repeated seed -> PASS; historical publication IDs and counts stable.
- `pnpm smoke:demo:full-application` -> PASS.
- `pnpm test:demo:roles` -> PASS for live credential/authority/logout checks and
  focused identity, guard, conduct, evaluation, and portal authorization tests.
- `pnpm test:demo:journey` -> PASS for Cedar PASS/ABSENT/WITHHELD privacy and
  Northstar PASS through the persisted portal repository.
- `pnpm verify:b04` -> PASS: 13 API tests, 4 Web tests, build/typecheck/lint gate.
- API and DB typechecks -> PASS.
- API and Web production builds -> PASS; Web chunks remain under 500 kB.
- Real Student 03 grade-card print -> PASS; one Letter-size PDF page.
- API and Worker health endpoints -> PASS in the seeded local environment.
- Local S3 mock/ClamAV storage lifecycle, infected promotion denial, generated
  private object, and signed download -> PASS.
- Notification ACCEPT/FAIL visibility and business-state isolation -> PASS.
- Bulk CSV artifact parsing, five-column shape inspection, and rendering -> PASS.

## Schema / Contracts / Environment

- Schema/migration: NONE.
- Shared contracts: NONE.
- Architectural decisions: NONE.
- New required environment variables: NONE. Optional `DEMO_SEED_TARGET` and
  `DEMO_SEED_ACK` exist only as mutation acknowledgements for non-local demos.
- Runtime fix: scheduling advisory locks use `$executeRaw` because the lock query
  has no result row; historical replay passes explicit repository clocks for
  registration transitions.

## Limitations / B05 Dependency

- Shared demo application and live shared role checks were not attempted.
- Printable HTML remains the private, version-bound B04 document mechanism; no
  public or stored document URL was added.
- Existing application commands do not create a persistent audit history for
  these seeded actions. B05 must treat persistent audit data as an explicit
  dependency and must not infer it from terminal-state records.
- The invalid scheduling/capacity/overlap and student-import fixtures remain
  reusable validation inputs; the seed does not persist invalid final states.

## Next Exact Action

1. Review the branch diff and merge it through `integration`.
2. Pull/rebase affected work onto the updated integration baseline.
3. If authorized, run the guarded seed and all four gates against the exact
   shared-demo target and update current state with the actual outcome.
4. Start `docs/codex/generated/B05-dashboard-reports-demo-polish.md` using the
   authoritative non-empty historical data.

## Minimal Context for the Next Session

1. `AGENTS.md`
2. this handoff
3. `docs/codex/CURRENT-STATE.md`
4. `docs/codex/SEEDED-ROLE-TEST-CREDENTIALS.md`
5. `docs/codex/generated/FULL-APPLICATION-demo-seed-and-flow-test.md`
6. `apps/api/scripts/full-application-demo.ts`
7. `fixtures/imports/bulk/README.md`
8. `docs/codex/evidence/full-application-demo/README.md`
