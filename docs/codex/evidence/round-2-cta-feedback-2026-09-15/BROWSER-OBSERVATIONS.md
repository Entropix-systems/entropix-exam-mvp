# Browser observations — Round 2 CTA feedback

Date: 2026-09-15  
Application: real local Vite web app on `http://localhost:5173` with the real Nest API on `http://localhost:3000` and seeded PostgreSQL data.

## Initial audit

The initial pass preceded implementation and traversed login/logout, password recovery, setup/access, academic masters, student import, exams/registration, scheduling, conduct/attendance, evaluation, results, reports, the student portal, and role-restricted direct routes. The Northstar institution administrator, Northstar faculty, and Cedar exam-controller seeded roles were used.

| Journey | Initial evidence |
|---|---|
| Faculty marks save | `Save draft` became disabled but retained idle text for the several-second request. Success appeared later as ordinary page-top content: `Marks draft saved.` |
| Academic master save | Save had a coarse page/dialog busy flag and no standardized spinner or action result notification. |
| Timetable | `Add hall` and `Initialize timetable` could be slow while their labels remained unchanged. |
| Student import | Preview/commit used a single boolean busy state; during commit both the hidden upload action and visible commit action could render loading simultaneously. |
| Action failures | Scheduling, conduct, evaluation, results, reports, platform, setup, and masters reused ordinary page-level message state for action failures. |
| Incident creation | The entered description was cleared before the request outcome was known. |
| Reports | A request identifier could be rendered to an ordinary user after an export failure. |
| Auth/context | Forgot-password, reset, invitation, logout, and context actions had inconsistent pending/duplicate feedback. |

## Re-test matrix

| Case | Browser procedure | Concrete observation | Result |
|---|---|---|---|
| Slow create | Created exam `R2-QA-0915` / `Round 2 QA Examination`. | Submit rendered `Creating…`, one spinner, disabled/`aria-busy`; dialog closed and the exam row appeared. | PASS |
| High-impact transition | Opened and then closed registration on `R2-QA-0915`. | `Opening…` then `Closing…`; controls were disabled until the state changed to `REGISTRATION OPEN` and then `PREPARATION`. | PASS |
| Long timetable command | Initialized the new exam timetable. | `Initializing…` and spinner remained for the complete multi-second request; the control returned to idle only after refreshed paper data arrived. | PASS |
| Slow update | Edited campus `R2QA0915`. | During request: `{ text: "Saving…", disabled: true, ariaBusy: "true", spinners: 1 }`. Completion showed the refreshed name and `Campus updated.` toast. | PASS |
| Submission/save | Saved a faculty marks draft. | During request: `Saving…`, spinner 1, disabled. Completion showed `Marks draft saved.` as a toast; no ordinary page-top action message remained. | PASS |
| Double click | Rapidly activated the faculty marks save while the request was pending. | Only one pending UI state was visible; the synchronous action-gate regression test independently proves the operation function is invoked once. | PASS |
| Invalid import | Uploaded `fixtures/imports/student-import-invalid.csv`. | `Validating…` while pending. Preview reported 0 valid / 2 rejected; row errors remained inline (`Roll number already exists`; unknown subject). No toast-only field error. | PASS |
| Valid import | Uploaded `fixtures/imports/northstar-students-valid.csv` and committed the preview. | Preview reported 100/100 valid. Commit rendered `Importing…`; implementation was refined from boolean to `preview`/`commit` phase so only the relevant CTA can spin. | PASS |
| Action-level network failure | Stopped the local API with the master edit dialog open, then selected Save. | Button rendered `Saving…`; failure returned it to idle, kept the dialog/data intact, and displayed `Unable to reach ExamOS. Check your connection and try again.` as an error toast. | PASS |
| Retry after failure | Restarted the API and retried the same campus save. | The updated row appeared and the success toast remained visible after the refresh completed. | PASS |
| Page-load failure | Stopped only the API, navigated to Students, and selected Retry after the failed load. | Persistent error card stayed visible with `Student directory could not be loaded.` and a Retry CTA; it did not auto-hide like a toast. | PASS |
| Page-load recovery | Restarted the API and selected Retry. | Error state cleared only after success; directory returned to `100 students` and 25 visible rows. | PASS |
| Validation/API 400 | Attempted a duplicate academic master code. | Dialog stayed open with `Code already exists in this academic scope`; no unrelated page error or ephemeral toast replaced the actionable form error. | PASS |
| Permission/direct route | Signed in as Northstar faculty and navigated directly to `/setup-access`. | Persistent `Access unavailable` page with explanatory copy and `Return to sign in`; no protected content rendered. | PASS |
| Responsive | Set explicit browser viewport to 390×844 on Students. | `innerWidth=390`, content viewport `375`, body scroll width `375`; no horizontal overflow and controls remained reachable. Viewport was reset afterward. | PASS |
| Browser health | Fresh post-fix page inspection. | Non-empty content, 3 landmarks, no `.vite-error-overlay`/framework overlay, zero browser error logs. | PASS |

## Screenshot evidence

The browser tool captured and visually inspected these states inline in the QA task:

1. Campus edit with disabled spinner and `Saving…`.
2. Refreshed campus row with green `Campus updated.` snackbar.
3. Faculty direct-route `Access unavailable` page.
4. Persistent Students page-load error with Retry.
5. Students directory recovered to 100 records after Retry.
6. Students layout at an explicit 390×844 viewport.

The safe browser-control surface returned the captures as inline pixel buffers and did not expose a workspace file-export operation. They are therefore not misrepresented as repository image files. The reproducible text/DOM observations above and the automated command record in `QUALITY-CHECKS.md` are the durable repository evidence.

## Limitations

- A true HTTP 409 race was not manufactured against production records. The shared normalizer’s 409 behavior is covered by unit test, while the browser exercised a real 400 domain validation conflict.
- A synthetic HTTP 403 action response was not injected. The real faculty direct-route denial was exercised; action-level 403 copy is covered by the normalizer test.
- No standalone document upload/generation mutation exists in the current UI, so document actions were inspected as read-only view/print behavior.
- No cross-browser matrix, screen-reader session, or load test was performed.
