# Examination ERP MVP — D0 Zero-State Verification

Verified at: 2026-09-13T07:09:49Z

Source commit tested:

445f198

## Result

D0 zero-state verification: PASS

A fresh clone of the integration branch was independently verified using newly generated credentials and newly created Docker volumes.

## Fresh Checkout

Verified:

- fresh clone from integration
- source commit matched the intended verification commit
- Node.js 24.20.0 repository pin
- pnpm 12.3.4 repository pin
- pnpm install --frozen-lockfile
- no tracked-file mutation after installation
- pnpm lockfile remained unchanged

## Infrastructure From Zero

Fresh Docker volumes were created for:

- PostgreSQL
- S3-compatible private object storage
- ClamAV

PostgreSQL bootstrap successfully created:

- exam_bootstrap
- exam_migration
- exam_app
- exam_mvp
- exam_mvp_shadow

## Database Verification

Verified:

- Prisma Client generation
- migrations deployed to an empty database
- migration status clean
- _prisma_migrations owned by exam_migration
- application tables owned by exam_migration
- exam_app runtime connectivity
- exam_migration migration connectivity
- tenant RLS isolation
- missing tenant context denied
- Tenant A isolation
- Tenant B isolation
- known foreign ID denied
- cross-tenant composite FK denied
- concurrent pool reuse safe
- no transaction tenant-context leakage

## Storage and Malware Scanning

Verified:

- S3-compatible storage startup from fresh volume
- ClamAV startup and health
- quarantine object creation
- clean-file malware scan
- quarantine-to-clean promotion
- quarantine cleanup after clean promotion
- EICAR infected-file detection
- infected object promotion denied
- generated private-object storage
- signed download URL generation

## Notification Boundary

Verified:

- deterministic accepted-email path
- deterministic failed-email path
- provider failure remains observable
- notification failure does not undo successful business state
- SMTP acceptance is not falsely represented as final delivery

## Contracts and Acceptance Fixtures

Verified:

- shared MVP contract smoke
- Northstar College fixture with 100 students
- Northstar subject/faculty fixtures
- Cedar School auto-enrol fixture
- invalid import fixtures
- result-engine R1-R6 fixtures
- demo role identities

## Engineering Gates

Verified from the fresh checkout:

- TypeScript typecheck
- production build
- lint
- unit tests
- API E2E test
- Web production preview
- API production process
- Worker production process
- Web health/access check
- API live and ready checks
- Worker live and ready checks

## Findings From Zero-State Verification

### Shell Environment Precedence

Previously exported PostgreSQL credential variables can override values intended to come from Docker Compose --env-file.

The initial zero-state database was therefore recreated after inherited PostgreSQL credential variables were cleared.

Future bootstrap automation must explicitly prevent inherited shell credentials from silently overriding the intended Docker environment file.

### Background Process Ownership

Stopping a background pnpm wrapper does not necessarily terminate the child Node.js process.

Future development/bootstrap helpers should manage child-process cleanup explicitly.

## Original Development Environment

After the temporary zero-state infrastructure was destroyed, the normal development infrastructure was restored using its preserved Docker volumes.

The following were reverified successfully:

- runtime Prisma connectivity
- tenant/RLS smoke
- private storage lifecycle smoke

## Conclusion

D0 zero-state verification: PASS

The repository can be cloned, installed, initialized, migrated, built, tested, and started without relying on hidden local repository state.
