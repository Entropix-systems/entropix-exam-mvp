# Seeded Role Test Credentials

> **Status: PENDING FULL-APPLICATION SEED**
>
> This tracked file is the shared credential reference for developers testing the
> fictional demo dataset. It may contain intentionally public test passwords only
> for `example.test` identities created by the guarded demo seed. These values must
> never be reused for production, staging accounts containing real data, or any
> non-fictional person. The seed must refuse to provision them in production.

Do not replace `PENDING` values until the full-application seed has provisioned
the account through the real authentication path and the corresponding login and
role assertion have passed. Never record database URLs, access or refresh tokens,
cookies, invitation/reset tokens, password hashes, or real-person credentials.

## Dataset

| Field | Value |
| --- | --- |
| Generated at | `PENDING` |
| Database target | `PENDING — disposable local or explicitly acknowledged fictional shared demo` |
| Seed version | `PENDING` |
| Seed command | `pnpm seed:demo:full-application` |
| Verification status | `PENDING` |

## Role Accounts

| Scenario | Email | Password | Institution | Active role | Scope | Expected route/state | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Platform administration | `PENDING@example.test` | `PENDING` | Platform | `PLATFORM_ADMIN` | Global | `PENDING` | `PENDING` |
| Northstar administration | `PENDING@example.test` | `PENDING` | Northstar College | `INSTITUTION_ADMIN` | Tenant | `PENDING` | `PENDING` |
| Cedar administration | `PENDING@example.test` | `PENDING` | Cedar School | `INSTITUTION_ADMIN` | Tenant | `PENDING` | `PENDING` |
| Result publication | `PENDING@example.test` | `PENDING` | `PENDING` | `EXAM_CONTROLLER` | Tenant/exam | `PENDING` | `PENDING` |
| Department review | `PENDING@example.test` | `PENDING` | `PENDING` | `DEPARTMENT_ADMIN` | `PENDING department` | `PENDING` | `PENDING` |
| Marks entry | `PENDING@example.test` | `PENDING` | `PENDING` | `FACULTY` | `PENDING department and subject` | `PENDING` | `PENDING` |
| Conduct | `PENDING@example.test` | `PENDING` | `PENDING` | `INVIGILATOR` | `PENDING sitting` | `PENDING` | `PENDING` |
| Read-only audit | `PENDING@example.test` | `PENDING` | `PENDING` | `AUDITOR` | Tenant | `PENDING` | `PENDING` |
| Context switch | `PENDING@example.test` | `PENDING` | `PENDING` | `PENDING roles` | `PENDING contexts` | `PENDING` | `PENDING` |

## Student Outcomes

| Scenario | Email | Password | Institution | Roll number | Expected outcome | Document expectation | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normal published result | `PENDING@example.test` | `PENDING` | Cedar School | `PENDING` | `PASS` | Admit card and grade card | `PENDING` |
| Explicit absence | `PENDING@example.test` | `PENDING` | Cedar School | `PENDING` | `ABSENT` | No numeric-zero substitution | `PENDING` |
| Held result | `PENDING@example.test` | `PENDING` | Cedar School | `PENDING` | `WITHHELD` | Hold message only; no grade card | `PENDING` |
| College pass | `PENDING@example.test` | `PENDING` | Northstar College | `PENDING` | `PASS` | Current result and grade card | `PENDING` |
| College fail | `PENDING@example.test` | `PENDING` | Northstar College | `PENDING` | `FAIL` | Current result and labelled grade card | `PENDING` |

## Negative Credential

| Scenario | Email | Password | Expected denial | Verified |
| --- | --- | --- | --- | --- |
| Suspended/inactive user | `PENDING@example.test` | `PENDING` | Login or live authority recheck denied | `PENDING` |

## Verification Notes

- Role test: `PENDING`
- School journey: `PENDING`
- College journey: `PENDING`
- Student portal/browser verification: `PENDING`

When the seed intentionally changes a shared test password, update this file in
the same commit and re-run the affected login checks so repository documentation
and the seeded database cannot silently diverge.
