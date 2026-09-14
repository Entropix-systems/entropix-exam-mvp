# Seeded Role Test Credentials

> Fictional local-demo accounts only. Every identity ends in `example.test`, and
> the shared password is intentionally public test data. Never reuse it outside
> a disposable local or explicitly acknowledged fictional demo database.

Do not record database URLs, access/refresh/reset tokens, cookies, or password
hashes here. The seed provisions these passwords through the real one-time reset
and Argon2 hashing workflow; it never inserts plaintext or a fabricated hash.

## Dataset

| Field | Value |
| --- | --- |
| Verified at | `2026-09-14` |
| Verified database target | Disposable local PostgreSQL (`exam_mvp`) |
| Shared demo target | **NOT APPLIED / NOT VERIFIED** |
| Seed version | `full-application-v1` |
| Seed command | `pnpm seed:demo:full-application` |
| Verification | Seed twice, structural smoke, role matrix, journeys, and browser evidence passed |

## Role Accounts

All usable accounts use password `DemoOnly!2026`.

| Fixture scenario | Email | Password | Institution | Active role | Scope | Expected landing | Expected result | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform administration | `platform.admin@demo.example.test` | `DemoOnly!2026` | Platform | `PLATFORM_ADMIN` | Global only; no tenant context | `/platform` | Platform context without tenant authority | PASS |
| Northstar administration | `institution.admin@northstar.example.test` | `DemoOnly!2026` | Northstar College | `INSTITUTION_ADMIN` | Tenant | `/academics` | Authorized Northstar administration | PASS |
| Cedar administration | `institution.admin@cedar.example.test` | `DemoOnly!2026` | Cedar School | `INSTITUTION_ADMIN` | Tenant | `/academics` | Authorized Cedar administration | PASS |
| Exam configuration/publication | `exam.controller@cedar.example.test` | `DemoOnly!2026` | Cedar School | `EXAM_CONTROLLER` | Tenant; `CEDAR-HIST-2026` | `/results` | Published v1 historical result | PASS |
| Department review | `department.admin@northstar.example.test` | `DemoOnly!2026` | Northstar College | `DEPARTMENT_ADMIN` | `CSE` department | `/evaluation` | Department-scoped independent review | PASS |
| Assigned marks entry | `ananya.iyer@northstar.example.test` | `DemoOnly!2026` | Northstar College | `FACULTY` | `CSE`; assigned `NORTHSTAR-HIST-2026` subjects | `/evaluation` | Assigned marks visible; unassigned writes denied | PASS |
| Assigned conduct | `nisha.rao@cedar.example.test` | `DemoOnly!2026` | Cedar School | `INVIGILATOR` | Accepted historical sitting; legitimate `FACULTY`/`INVIGILATOR` contexts | `/conduct` | Assigned roster visible; unassigned writes denied | PASS |
| Read-only institution access | `auditor@northstar.example.test` | `DemoOnly!2026` | Northstar College | `AUDITOR` | Tenant read-only | `/` | Read access without mutation authority | PASS |
| Context switch | `context.switch@northstar.example.test` | `DemoOnly!2026` | Northstar College | `EXAM_CONTROLLER` | Legitimate `EXAM_CONTROLLER` and `AUDITOR` grants | `/results` | Both server-authorized contexts selectable | PASS |

## Student Outcomes

All student accounts use password `DemoOnly!2026` and land on `/student`.

| Fixture scenario | Email | Password | Institution | Active role | Roll number | Expected landing | Expected result | Document expectation | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Normal published result | `student.03@cedar.example.test` | `DemoOnly!2026` | Cedar School | `STUDENT` | `CED10A03` | `/student` | `PASS`, 75%, GPA 8 | Admit card and one-page grade card | PASS |
| Explicit absence | `student.01@cedar.example.test` | `DemoOnly!2026` | Cedar School | `STUDENT` | `CED10A01` | `/student` | `ABSENT` | Grade card labels absence; never numeric zero | PASS |
| Held result | `student.02@cedar.example.test` | `DemoOnly!2026` | Cedar School | `STUDENT` | `CED10A02` | `/student` | `WITHHELD` | Hold message only; no marks, percentage, GPA, or grade card | PASS |
| College pass | `student.001@northstar.example.test` | `DemoOnly!2026` | Northstar College | `STUDENT` | `NS26001` | `/student` | `PASS` | Current result and grade card | PASS |

`NS26002` is the Northstar `FAIL` API/result fixture. It intentionally has no
documented login credential because the minimum role/student matrix is already
covered by the four identities above.

## Negative Credential

| Scenario | Email | Password | Expected denial | Verified |
| --- | --- | --- | --- | --- |
| Suspended user | `suspended@cedar.example.test` | `DemoOnly!2026` | Authentication denied before tenant authority is granted | PASS |

## Verification Notes

- `pnpm smoke:demo:full-application` verifies the two historical publications,
  exact seats, accepted duties, submitted attendance, approved marks, outcome
  counts, credential graph, and the unchanged Cedar future timetable.
- `pnpm test:demo:roles` authenticates every declared credential, switches the
  multi-role contexts, verifies live server-resolved authority, expected
  suspended denial, logout/refresh revocation, tenant isolation, and focused
  service guardrails for student ownership, unassigned marks/sittings,
  independent review, and read-only role enforcement.
- `pnpm test:demo:journey` verifies Cedar PASS/ABSENT/WITHHELD privacy plus the
  Northstar PASS path through the real persisted portal repository.
- Browser evidence is indexed under
  `docs/codex/evidence/full-application-demo/README.md`.

An intentional password rotation must update the seed and this file in the same
change and rerun every affected login assertion.
