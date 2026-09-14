# B04A — Full-Flow Demo Seed & End-to-End Test

## Objective

Before starting B05, add a safe, repeatable fictional dataset and focused
end-to-end gate that exercise the complete Examination ERP journey from
registration through a published student grade card. The dataset must make
dashboard/report work credible without falsifying the still-upcoming Cedar
Annual Examination.

## Required Context

Read only:

1. `AGENTS.md`
2. `docs/codex/CURRENT-STATE.md`
3. `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md`
4. this prompt
5. the existing seed scripts under `packages/db/scripts/`
6. the current Conduct, Evaluation, Results, Identity, and Student Portal
   application services/repositories

Repository state is authoritative. B04 is merged locally at `536fac9`. Refresh
from the latest `integration` before creating a short-lived task branch.

## Timing and Fixture Strategy

- Run this task after B04 and before
  `docs/codex/generated/B05-dashboard-reports-demo-polish.md`.
- Preserve Cedar `ANNUAL-2026`, its 15-17 September 2026 schedule, seats, and
  current admit-card behavior unchanged.
- Add separate, clearly named historical fictional exams with fixed dates before
  14 September 2026. Do not publish a result for a future sitting.
- Keep Northstar College and Cedar School as the only fixture institutions.
- Use deterministic codes, dates, roll numbers, halls, marks, and outcomes so
  repeated runs produce the same assertions.

## Required Demo Outcomes

Create a completed Cedar historical school journey that includes:

- school auto-enrolment and approved registrations
- a published timetable with deterministic halls and seats
- assigned and accepted invigilator duties
- submitted attendance containing PRESENT and ABSENT
- one disposed student incident with `RETAIN_WITHHELD`
- marks entered and submitted by the assigned examiner
- independent approval by another authorized membership
- an immutable result run and exactly one current publication
- Cedar Student 01 producing ABSENT without numeric-zero substitution
- Cedar Student 02 producing WITHHELD with no numeric/component leakage and no
  grade card
- Cedar Student 03 producing a normal published result and eligible grade card

Create a smaller completed Northstar historical college journey that includes:

- student application, eligibility, submission, and controller approval
- published schedule/seat, completed conduct, independently approved marks, and
  a current publication
- at least one PASS and one FAIL when the existing fictional roster supports it
- tenant isolation from every Cedar record

Do not delete useful existing fixture cases such as rejected registrations,
inactive students, duplicate roll numbers, unknown subjects, or schedule
conflict examples.

## Implementation Rules

- Add an explicit root command such as `pnpm seed:demo:full-flow` and a separate
  read-only verification command such as `pnpm smoke:demo:full-flow`.
- Keep `pnpm seed:demo` idempotent. Either append the historical journey safely
  or make the full-flow command call the existing seed chain first.
- Drive workflow transitions through the existing application
  services/repositories and their concurrency/business checks. Do not use raw SQL
  or direct terminal-state table updates to mark duties accepted, attendance
  submitted, marks approved, or results published.
- Replay historical conduct through the existing injectable application clocks,
  using deterministic action timestamps inside each configured sitting window;
  do not disable or widen the conduct-window rule.
- Use restricted runtime access and `withTenant()` for tenant-owned persistence.
- Preserve the real separation of duties: the marks submitter must not approve
  their own batch.
- Do not weaken conduct windows, tenant scope, result readiness, publication
  revision checks, ABSENT semantics, or WITHHELD privacy.
- Do not create public document URLs. Admit and grade cards remain the B04
  version-bound printable HTML references.
- Do not create or fabricate audit history for B05. If existing commands do not
  yet emit audit events, record that as a B05 dependency.
- Do not commit plaintext passwords or tokens. If browser verification needs a
  credential, provision a fictional account through the existing reset or
  invitation workflow using an ignored/runtime-only value.

## Safety and Targeting

- Default to disposable local PostgreSQL.
- Refuse to run when `NODE_ENV=production`.
- Require an explicit acknowledgement and exact target name before mutating a
  shared demo database.
- Print a preflight summary naming the database category, tenant slugs, and exam
  codes before mutations; never print connection strings, passwords, or tokens.
- Make reruns convergent. Do not withdraw/recreate an unchanged publication or
  accumulate duplicate duties, attendance, batches, result runs, publications,
  or document references.
- Do not run the existing `smoke:results-flow` against shared demo data; it is a
  destructive correction-flow test intended only for disposable databases.

## End-to-End Assertions

The read-only full-flow smoke must prove:

1. Both tenant journeys resolve only their own records.
2. Registration, schedule, seat, duty, attendance, incident, marks, approval,
   run, and publication states are internally consistent.
3. Every result item derives from approved marks and submitted conduct.
4. Exactly one current publication exists per completed historical exam.
5. Retrying the seed does not change counts, versions, issue IDs, or publication
   identity when inputs are unchanged.
6. Student 03's `/api/v1/me/student-portal` response includes the current
   published result and eligible grade-card metadata.
7. Student 02 receives only the WITHHELD hold response and no grade card.
8. Student 01 remains explicitly ABSENT rather than receiving zero marks.
9. A known cross-tenant ID and another student's identity cannot expose records.
10. Cedar `ANNUAL-2026` retains its current published schedule, seat allocation,
    schedule revision, and admit-card issue identity.

Run the seed twice locally and compare the summarized IDs/counts. Then perform
one real authenticated Cedar Student 03 browser journey covering login, reload,
published result, one-page grade-card print, logout, and absence of browser/Vite
errors. Run a focused Northstar API/browser journey sufficient to prove the
college registration/result path and tenant separation.

## Schema and Contract Impact

Expected schema/migration impact: **NONE**.

Expected shared-contract impact: **NONE** unless a missing read-only smoke DTO is
discovered. If schema or shared contracts are genuinely required, stop, inspect
`CURRENT-STATE.md`, acquire the applicable lock, and record the cross-lane impact
before editing.

## Verification

Use the smallest meaningful gate:

- seed command against disposable local PostgreSQL — PASS
- identical second seed run — PASS with stable summary
- read-only full-flow smoke — PASS
- existing `pnpm verify:b04` — PASS
- relevant API/DB typecheck or build — PASS
- real Cedar Student 03 result/grade-card browser and print check — PASS
- focused Northstar college flow and tenant-isolation check — PASS

Do not run broad verification unless preparing the final integration gate or a
shared foundation was changed.

## Completion and Handoff

Update:

- `README.md` with safe local and explicitly acknowledged shared-demo commands
- `docs/codex/CURRENT-STATE.md` with exact seeded counts/outcomes and whether the
  shared demo was actually updated
- `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md` with commands, evidence,
  credentials handling, limitations, and the B05 start action

Report attempted commands separately from successful local/shared application.
Do not claim the full-flow dataset exists on the shared demo until the guarded
shared-target command actually succeeds and the read-only smoke confirms it.

The task is complete when the repository can reproduce the full historical
school and college journeys from a clean local setup, B04 shows a real published
grade card for an eligible student, the future Cedar admit-card fixture remains
unchanged, and B05 can consume authoritative non-empty readiness/report data.
