# Current Engineering State

## Baseline

```text
Known-good foundation: d0-ready
Known-good D0 verification: PASS at integration SHA 6182f80
Shared development branch: integration
Current sprint: D1–D3 MVP implementation
Current day: D1 IAM FINAL CONVERGENCE COMPLETE
```

## Current Gate

```text
IAM browser/API demo journey passes on the merged integration implementation.
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
IAM Phase 3 PostgreSQL persistence, production API wiring and admin endpoints
IAM browser login, membership directory, invitation, session, recovery,
deactivation and tenant-isolation demo gate
```

## In Progress

```text
M01 Academics Department records and IAM department-source integration
```

## Blockers

```text
Department-backed role selection awaits real Department records from M01 Academics.
IAM does not own or fabricate Department records.
```

## Migration Lock

```text
Owner: NONE
Purpose: IAM Phase 3 migration is merged
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
Status: IAM DEMO GATE PASS ON MERGED INTEGRATION IMPLEMENTATION
```

## Developer B

```text
Task: IAM Phase 3 Backend/DB
Branch: `d1-b-iam-phase3`
Status: MERGED INTO INTEGRATION
```

## Latest Integrated Acceptance

```text
Known-good D0 verification: PASS at integration SHA 6182f80.
Focused IAM browser/API/database demo journey: PASS.
```

## Next Required Action

```text
Move off IAM. When M01 Academics lands, consume its real Department source to
enable department-backed grants; do not add an IAM-owned Department model.
```
