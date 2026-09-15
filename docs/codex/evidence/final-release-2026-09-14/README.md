# Final release browser evidence — 2026-09-14

These captures were produced from the fresh clean checkout at implementation
commit `88141c60a62fbebda12280b27c8c02c8b6f5f3fc`, served locally with the
repository-pinned Node 24.20.0 and pnpm 12.3.4. Browser console warning/error
inspection was empty at the final checkpoints. No cookies, access tokens,
passwords, or database URLs are recorded here.

| File | Verified state |
| --- | --- |
| `00-login.jpg` | Clean login page before authentication. |
| `01-generic-login-error.jpg` | Invalid credentials remain generic. |
| `02-platform-workspace.jpg` | Platform administrator lands on `/platform` without an institution-only API denial. |
| `03-native-validation-no-stale-error.jpg` | Editing/clearing credentials removes the stale server error before required-field validation. |
| `04-desktop-marks-badges.jpg` | Faculty `/marks`; approval and readiness badges remain content-sized. |
| `05-role-switch-attendance.jpg` | Faculty-to-Invigilator switch routes to `/attendance`; conduct badges remain compact. |
| `06-northstar-current-attention.jpg` | Current Northstar exam shows the first pending readiness step and matching action. |
| `07-northstar-historical-ready.jpg` | Historical Northstar exam shows all-ready state and expected counts/publication. |
| `08-cedar-historical-results.jpg` | Cedar historical result counts: PASS 18, FAIL 0, ABSENT 1, WITHHELD 1, publication v1. |
| `09-absent-grade-card.jpg` | ABSENT remains explicit, subject values nonnumeric, aggregate GPA 0.00, grade card available. |
| `10-withheld-privacy.jpg` | WITHHELD exposes only the hold state; no marks, percentage, GPA, or grade card. |
| `11-pass-grade-card.jpg` | PASS retains 75%, GPA 8.00, grade B, and grade-card access. |
| `12-northstar-student-pass.jpg` | Northstar student sees only the own PASS result, timetable, hall, and seat. |
| `13-suspended-generic-denial.jpg` | Suspended-account denial does not enumerate account state. |
| `14-unauthorized-direct-route.jpg` | Direct Faculty access to `/attendance` remains denied by the server-backed authorization path. |

The capture surface exposed a fixed desktop viewport (up to 1440x706); image
dimensions therefore vary with the page's visible panel. Fresh computed geometry
confirmed `align-self: flex-start`, content-width badges, and no horizontal
overflow on marks and attendance. The viewport-independent CSS regression suite
also passed. The already-completed 390x844 remediation browser check recorded in
`POST-REMEDIATION-VERIFICATION.md` remains valid; no new regression evidence was
found and the completed BUG-005 item was not reopened.
