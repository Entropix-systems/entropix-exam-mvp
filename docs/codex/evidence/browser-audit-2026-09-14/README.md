# Browser audit evidence — 2026-09-14

Curated read-only evidence for the full-application audit at commit `7fdee3eece280e591a220b56422b033a45b285d2`.

The captures contain only seeded fictional application data. No passwords, tokens, full database URLs, or developer-tool payloads are included.

| File | Dimensions | Purpose |
| --- | --- | --- |
| `northstar-historical-overview.jpg` | 1440×900 | Completed Northstar readiness/publication state and the attention-card enhancement source. |
| `cedar-historical-results.jpg` | 1425×891 | Cedar result totals, ABSENT GPA `0.00`, and readiness badge geometry. |
| `cedar-withheld-privacy.jpg` | 1425×891 | WITHHELD student privacy state with numeric details and grade card unavailable. |
| `marks-status-layout.jpg` | 1265×791 | Desktop `CONDUCT READY` badge stretching in the marks summary header. |
| `mobile-attendance.jpg` | 375×812 | Mobile attendance layout, horizontal nav behavior, and stretched `SUBMITTED` badge. |
| `mobile-student-portal.jpg` | 375×812 | Mobile student portal stacking and lack of document-level horizontal overflow. |
| `login-stale-error.jpg` | 1280×800 | Stale invalid-credentials error coexisting with native required-field validation. |

Images are JPEG because that is the browser capture format supplied by the audit tooling. They are evidence, not golden snapshots; stable automated tests should assert behavior and geometry rather than byte equality.

See [the full report](../../reviews/FULL-APPLICATION-browser-audit-2026-09-14.md) for reproduction steps, expected/actual behavior, acceptance mapping, and limitations.
