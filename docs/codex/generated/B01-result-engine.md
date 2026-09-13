# B01 — Result Rules / Pure Engine

## Objective

Implement the deterministic, decimal-safe pure result engine and rule validation needed by the supplied fixtures, independent of unfinished database and API work, so Developer B can start immediately.

## Existing Context

- Start with only `AGENTS.md`, `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md`, this prompt, current Git status, and the files below.
- IAM and D0 are complete and irrelevant to this pure-domain slice; do not inspect them.
- Mockup references: [Results](../../design/index.html#results) and [Marks & review](../../design/index.html#marks) in `docs/design/index.html`; ensure engine outputs support the displayed terminology and fixture values without moving UI concerns into the domain.
- `packages/domain/src/results/index.ts` and `packages/domain/src/rules/index.ts` are empty.
- `fixtures/results/result-engine-fixtures.json` is the executable source for the key examples.
- Required upstream work: NONE.

## Do Not Do

- Do not add database models, API endpoints, UI, worker jobs, or arbitrary executable grading formulas.
- Do not use binary floating-point for threshold decisions or round before comparison.
- Do not implement historic CGPA, grace marks, or cross-exam aggregation.
- Do not reread all project docs or run full repository verification.

## Implementation Scope

Implement:

- Validated declarative rule input for single FINAL or INTERNAL+EXTERNAL components.
- Subject percentage, component-threshold, grade, points, ABSENT, and WITHHELD behavior.
- Student aggregate outcome, overall percentage suppression/precedence, and optional current-exam GPA.
- Focused tests driven by every fixture case and invalid configuration/input.

Do not implement:

- Persistence, snapshots, publication, API serialization, or UI formatting beyond returned display strings.

## Business Rules

- Weights sum exactly to 100; component maxima are positive; thresholds are valid; grade bands cover 0–100 without gaps/overlap.
- Decisions use exact unrounded decimal values; display percentage/GPA rounds half-up to two decimals.
- `32/40 + 42/60 → 74 → PASS/B`; `36/40 + 18/60 → FAIL` when external minimum is 40%.
- Raw `39.995` displays `40.00` but remains FAIL at a 40 threshold.
- ABSENT has no percentage/grade and zero GPA points; WITHHELD hides percentage, grade, and GPA.
- Present missing required marks is incomplete input and blocks a result run.
- Aggregate precedence: WITHHELD, then ABSENT, then FAIL; GPA includes failed/absent credits with zero points and is suppressed for WITHHELD.

## Likely Files / Modules

Inspect first:

- `fixtures/results/result-engine-fixtures.json`
- `packages/domain/src/results/index.ts`
- `packages/domain/src/rules/index.ts`
- `packages/domain/src/index.ts`
- `packages/contracts/src/results.ts`
- `packages/contracts/src/evaluation.ts`
- `docs/design/index.html` (`#results` and `#marks` only)

Likely changes:

- `packages/domain/src/results/`
- `packages/domain/src/rules/`
- focused domain test files
- domain package metadata only if a small decimal dependency is necessary

## Schema / Contract Impact

Schema:

- NONE.

Shared contracts:

- NONE for the initial pure engine. Keep engine value types local; if A03 needs an exported RuleVersion DTO, coordinate it with DEV A under the contract lock rather than duplicating it.

## Acceptance

The task is complete when:

- All supplied result fixtures pass with deterministic repeatable values.
- Invalid weights, maxima, bands, credits, and missing required marks fail explicitly.
- ABSENT and WITHHELD never leak numeric results.
- Consumers can call a small pure API without Nest, Prisma, or environment state.

## Verification

Run only:

- focused domain result/rule unit tests
- `pnpm --filter @entropix/domain typecheck`
- fixture check if the test reads the shared fixture file

## Execution Instruction

Start implementation immediately on a short-lived task branch. Do not return PLAN ONLY or wait for PROCEED unless an unavoidable shared-contract conflict appears.

## Session Handoff

Before ending, replace stale facts in `docs/codex/handoffs/dev-b/SESSION-HANDOFF.md` using its existing required headings. Record the public pure API, exact fixture verification, contract decisions, limitations, relevant files, blockers, and the next exact action. Do not append a diary.
