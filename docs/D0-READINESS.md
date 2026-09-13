# Examination ERP MVP — D0 Readiness

Status: READY FOR DAY 1 IMPLEMENTATION

This record establishes that the engineering baseline required to begin the three-day MVP implementation sprint has been prepared and verified.

It does not establish production readiness, live-examination readiness, compliance certification, or pilot acceptance.

## Repository and Runtime

- integration branch established
- Node.js version pinned
- pnpm version pinned
- deterministic lockfile present
- monorepo workspace established
- Web, API and Worker applications build successfully
- shared contracts/domain/database/storage/notification packages build successfully

## Service Boundaries

- React web application
- NestJS REST API
- separately runnable Worker
- modular examination domain boundaries
- API and Worker health endpoints

## Database

- PostgreSQL foundation established
- Prisma migration workflow established
- migration role separated from runtime role
- runtime role cannot create schema objects
- runtime role is not superuser
- runtime role has no BYPASSRLS
- tenant tables use enforced RLS
- transaction-local tenant context verified
- missing tenant context denied
- known cross-tenant IDs denied
- connection-pool tenant leakage test passed

## Hosted Staging Database

- Supabase staging PostgreSQL provisioned
- separate exam_migration and exam_app roles verified
- staging migrations deployed
- application table ownership verified
- Supabase generic API roles have no ERP table privileges
- tenant/RLS adversarial smoke passed through the Supabase session pooler
- CA-aware runtime database configuration established

## Private Documents

- private S3-compatible storage adapter established
- quarantine, clean and generated key spaces established
- ClamAV INSTREAM scanner established
- clean-file promotion verified
- infected-file promotion denial verified with EICAR
- short-lived signed URL generation established

Business authorization, document assignment, scan-state and access-window checks remain application-layer Day 2 work and must precede signed URL issuance.

## Notifications

- provider-independent email interface established
- deterministic test sender established
- SMTP provider adapter established
- provider failures remain observable
- notification failure does not roll back successful business state
- SMTP acceptance is not represented as final delivery

A real staging-provider send must be verified before pilot execution.

## Contracts and Fixtures

- shared MVP contracts frozen
- Northstar College fixture prepared
- 100 Northstar students prepared
- three Northstar subjects prepared
- three-or-more Northstar faculty prepared
- Cedar School auto-enrol fixture prepared
- duplicate-roll fixture prepared
- unknown-subject fixture prepared
- inactive-student fixture prepared
- rejected-application fixture prepared
- dual-department-faculty fixture prepared
- result-engine R1-R6 fixtures prepared
- role-identity fixtures prepared
- no real student data stored in fixtures

## CI

CI verifies:

- frozen dependency installation
- fixture validation
- shared contracts
- typecheck
- build
- lint
- unit tests
- API E2E
- PostgreSQL bootstrap
- migrations from zero
- runtime database connectivity
- tenant/RLS adversarial tests
- Web/API/Worker health
- private object-storage lifecycle
- malware-scanning lifecycle

## Zero-State Verification

A fresh independent clone was successfully:

- installed using the frozen lockfile
- initialized with new database/storage volumes
- migrated from an empty database
- built
- linted
- tested
- started using production build commands

Web, API and Worker runtime checks passed.

The fresh checkout remained Git-clean and did not mutate the lockfile.

## Bootstrap Safeguards

The zero-state test identified that exported shell credentials can override Docker Compose --env-file values.

The repository now provides a safe infrastructure startup command that removes inherited PostgreSQL credential overrides before invoking Docker Compose.

The zero-state test also identified that terminating a pnpm wrapper may leave its Node child alive. A development cleanup helper is provided for application ports.

## D0 Gate

The engineering baseline is ready for Day 1 when all of the following are true:

- working tree is clean
- final D0 verification passes
- GitHub CI is green
- no critical/high D0 foundation defect remains
- the exact D0 commit is tagged

## Explicit Non-Claims

D0 readiness does not mean:

- M01-M10 are implemented
- browser lifecycle acceptance is complete
- real examination data may be used
- real examination execution is approved
- release/pilot gates have passed
- the system is production-ready

Those require the three-day implementation work and later release gates.

## Next Step

Begin Day 1 vertical implementation using the frozen contracts, deterministic fixtures and verified infrastructure baseline.
