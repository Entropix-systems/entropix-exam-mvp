# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Known-good D0 verification: PASS at integration SHA 6182f80
Shared development branch: integration
Current sprint: D1–D3 MVP implementation
Current day: D1 IAM IMPLEMENTATION
```

## Current Gate

```text
Review IAM Phase 2 application/browser orchestration and complete the D1 shared
domain/IAM migration before production identity wiring.
```

## Completed

```text
D0 engineering foundation
repository structure
tenant/RLS foundation
database role separation
worker foundation
private storage/scanner foundation
email abstraction
fixtures
CI
fresh-clone verification
d0-ready tag
```

## In Progress

```text
D1 IAM Phase 1 security foundation: branch `d1-a-iam-phase1`
D1 IAM Phase 2 application/API/web orchestration: branch `d1-a-iam-phase2`
D1 shared-domain migration: owned by Developer B
```

## Blockers

```text
IAM production wiring and A14 database acceptance are blocked on real
Session/AuthToken/invitation persistence and transaction adapters.
```

## Migration Lock

```text
Owner: Developer B
Purpose: D1 shared-domain and IAM persistence migration
```

## Shared Contract Lock

```text
Owner: Developer A
Purpose: D1 contract freeze
```

## Developer A

```text
Task: D1 IAM Phase 2
Branch: d1-a-iam-phase2
Status: APPLICATION/API/WEB ORCHESTRATION IMPLEMENTED; D0 VERIFY PASS;
PRODUCTION WIRING BLOCKED ON MIGRATION
```

## Developer B

```text
Task: First D1 migration after contract freeze
Branch: TBD
Status: D1 SHARED-DOMAIN MIGRATION IN PROGRESS
```

## Latest Integrated Acceptance

```text
Known-good D0 verification: PASS at integration SHA 6182f80.
D1 business gate has not started.
```

## Next Required Action

```text
Developer B must account for the persistence handoff in `IAM-PHASE2.md`. After the
reviewed migration merges, Developer A must resync and implement real adapters as a
separately authorized Phase 3.
```
