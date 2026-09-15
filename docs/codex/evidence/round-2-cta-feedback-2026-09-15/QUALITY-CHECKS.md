# Round 2 quality-check record

Date: 2026-09-15

## Passing checks

| Command | Result |
|---|---|
| `pnpm --filter @entropix/web typecheck` | PASS |
| `pnpm --filter @entropix/web test` | PASS — 20 files, 61 tests |
| `pnpm --filter @entropix/web lint` | PASS |
| `pnpm --filter @entropix/web build` | PASS — 954 modules transformed |
| `pnpm --filter @entropix/api typecheck` | PASS |
| `pnpm --filter @entropix/api lint` | PASS |
| `git diff --check` | PASS |
| Browser render/overlay/console check | PASS — content present, no Vite overlay, zero error logs |

The frontend build emits the repository’s existing main-chunk size advisory (`index` approximately 632 kB minified). It is a warning, not a build failure, and this UX remediation did not introduce a new large dependency.

## New focused regression coverage

- `AsyncButton` emits disabled semantics, `aria-busy`, spinner, and progressive copy while loading.
- `AsyncButton` retains its normal label and enabled behavior while idle.
- The async action gate suppresses a second invocation until the first settles.
- The action gate allows a retry after failure.
- The API error normalizer covers network, 403, 409, server/500, and field-validation behavior.

## API suite exception

The full API run was retried outside the sandbox after an initial port/database access failure. Final result: **17 test files passed, 2 failed; 130 tests passed, 2 failed (132 total).** Both failures are in unchanged identity code/tests and are unrelated to the web-only CTA remediation:

1. `auth.controller.spec.ts` expects the old `switchContext` call shape and does not include the now-present `requestId` / `returnToPlatform` properties.
2. `security.spec.ts` expects a platform access token missing a claim to reject, while the current codec resolves it as a valid platform principal.

No API source, contract, migration, schema, authorization rule, workflow state, or result calculation was changed in this round. The failures are disclosed rather than silently ignored or altered as part of an unrelated UI task.
