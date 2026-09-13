# IAM Phase 2 — Application and Browser Orchestration

Status: IMPLEMENTED, including the production PostgreSQL adapter and the IAM QA
context follow-up on `fix/qa-iam-context`.

## Application workflows

`AuthApplicationService` orchestrates login, refresh, logout, revoke-all-own
sessions, forgot/reset password, invitation acceptance, and current context. It
depends on `IdentityWorkflowRepository`; no production in-memory repository exists.

The repository adapter must make the following decisions and mutations atomic:

- Login rechecks ACTIVE User, Tenant and Membership state, deterministically chooses
  the user's first active institution membership and effective role, then creates
  Session plus hashed REFRESH AuthToken. It never accepts an institution selector.
- Context switching locks the session, verifies the requested institution and role
  belong to the authenticated user, and atomically updates Session plus its live
  REFRESH AuthToken binding.
- Refresh conditionally consumes the current token, detects reuse, creates one
  successor, and commits session-family revocation before returning `REPLAY`.
- Reset consumes one reset token, verifies the User is still ACTIVE, changes the
  password hash, revokes every active session and invalidates remaining reset tokens.
- Invitation acceptance validates the token and server-owned tenant/membership
  binding, protects an existing password, and activates only eligible records.

Public login, refresh, reset and invitation failures use generic messages. Forgot
password always returns `{ accepted: true }`; an email is attempted only after the
token-hash command succeeds, and delivery failure does not change that response.
Raw invitation/reset/refresh tokens are transport values only and are never passed
to persistence or logs.

## HTTP surface and transport

The prepared controller surface under `/api/v1` is:

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/context
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/invitations/accept
GET  /auth/me
```

Responses use the shared `{ data, requestId }` success envelope and safe error
envelope. `INTERNAL_ERROR` is now a typed API error code so unexpected exceptions
do not masquerade as validation failures or expose infrastructure diagnostics.

Login and refresh return access-token metadata in the JSON envelope. The raw refresh
token is placed only in the Phase 1 HttpOnly, SameSite=Lax cookie; it is Secure and
uses the `__Host-` prefix outside explicit local development. Refresh and logout
require an exact configured Origin plus the non-simple `x-csrf-protection: 1`
header. The header is a CSRF signal, not a secret. Refresh output is never cached
under business idempotency semantics.

`IdentityHttpModule` is intentionally absent from `AppModule`. Importing it before
supplying real repository, authority resolver, crypto, notification, cookie, origin,
clock and auth-configuration providers must fail Nest dependency resolution. This
keeps the production API from advertising fake successful persistence.

## Browser shell

The React shell provides credential-only login, forgot-password, reset-password, invitation
acceptance, access-denied and authenticated-context screens. `AuthProvider` restores
the session through refresh, holds the access token only in an `AuthApiClient`
instance in memory, protects routes, clears state on logout/failure, and maps denied
authority to the access-denied state. The authenticated sidebar shows the verified
institution name and email, renders institution/role selectors only when multiple
choices exist, and remounts tenant pages after a context change. Permission-sensitive
navigation and commands use only the server-resolved active role. UUIDs remain
internal values.

The Setup & access staff directory uses bounded server-side cursor pagination,
shows loading/error/empty states, and excludes Student identities. Page-size and
cursor validation occur before persistence; foreign or stale cursors are not
accepted as cross-tenant probes.

Ordinary requests share one in-flight refresh promise. Refresh cookies remain
inaccessible to JavaScript. The auth client does not use localStorage,
sessionStorage or IndexedDB. One-time URL tokens are captured in memory and removed
from browser history after mount.

## Phase 3 persistence handoff

The migration and real adapter must provide:

- `User.platformRole`, nullable and constrained to `PLATFORM_ADMIN`.
- Canonical lowercase user emails (or equivalent case-insensitive uniqueness and
  lookup) and canonical lowercase tenant slugs, matching login normalization.
- A global Session family record with user, PLATFORM/TENANT context kind, nullable
  but paired tenant/membership binding, expiry/use/revocation metadata and indexes.
- AuthToken with unique tokenHash, purpose INVITATION/PASSWORD_RESET/REFRESH, user,
  optional session/tenant/membership/predecessor, expiry and consumed/revoked data.
- At most one refresh successor, same-family predecessor validation, and retention
  of consumed refresh hashes until family expiry so replay remains detectable.
- Department scope on RoleGrant with same-tenant Department integrity and null-safe
  uniqueness for `(membership, role, department scope)`.
- A non-active pre-acceptance membership/account representation. The status name is
  not frozen here; the migration must ensure invitation creation cannot grant active
  access before a valid atomic acceptance, and acceptance cannot reactivate a
  suspended user.
- Restricted identity-only global token/session entry points. Tenant Membership,
  RoleGrant and target-resource reads continue through `withTenant()` and FORCE RLS.

The Phase 3 adapter must implement every `IdentityWorkflowRepository` mutation and
`AuthenticatedContextResolver` recheck against current persisted authority. Session
revocation, replay protection, invitation/reset single use and A14 acceptance cannot
be claimed until those transactions and PostgreSQL concurrency tests exist.

## Verification

Focused application, guard, HTTP, browser-client and PostgreSQL tests are present
with explicit test doubles outside persistence coverage. No test double is exported
to production wiring. The corrected transactional migration was applied to the
disposable local PostgreSQL database; its schema status, Prisma validation, runtime
smoke and tenant-RLS smoke pass. The PostgreSQL IAM suite has 9 passing tests, the
full API suite 82, API E2E 2, Web 26, Domain 32, and Worker 2.

The canonical `pnpm d0:verify` gate passes, including fixtures, contracts, all
workspace typechecks/builds/lints/tests, storage and notification smoke tests, and
API E2E. Verification used available Node 24.19.0 and pnpm 11.19.0; the repository
pins Node 24.20.0 and pnpm 12.3.4, so the gate reports a non-failing engine warning.
After explicit approval, the migration was also deployed to the shared Supabase
demo database. Prisma reports its migration schema up to date; live login returned
HTTP 201 and `/auth/me` resolved `admin@northstar.example.test` to Northstar College
with active role `INSTITUTION_ADMIN`.
