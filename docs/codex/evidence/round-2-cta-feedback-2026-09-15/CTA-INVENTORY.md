# ExamOS Round 2 CTA inventory

Date: 2026-09-15

This inventory records the meaningful controls encountered in the implemented browser journeys. “Severity” is the severity of the pre-remediation feedback gap. Navigation, disclosure, and local document controls are included to make the async boundary explicit; they intentionally do not receive mutation loaders.

| Screen | CTA label(s) | Role(s) observed | Action | Async | Current feedback | Loading | Disabled pending | Success | Error | Duplicate risk | Error presentation | Severity |
|---|---|---|---|---:|---|---:|---:|---:|---:|---:|---|---|
| Sign in | Sign in | All | Authenticate | Yes | Spinner + `Signing in…` | Yes | Yes | Navigation | Inline auth error | No | Auth-form inline | P1 |
| Sign in | Forgot password? | All | Navigate | No | Immediate navigation | N/A | N/A | Destination page | N/A | No | N/A | — |
| Forgot password | Send reset link | All | Request reset | Yes | Spinner + `Sending…` | Yes | Yes | Existing success content | Inline auth error | No | Auth-form inline | P1 |
| Forgot password | Back to sign in | All | Navigate | No | Immediate navigation | N/A | N/A | Destination page | N/A | No | N/A | — |
| Reset password | Reset password | All | Reset credential | Yes | Spinner + `Resetting…` | Yes | Yes | Existing success content | Inline auth error | No | Auth-form inline | P1 |
| Reset password | Continue to sign in | All | Navigate | No | Immediate navigation | N/A | N/A | Destination page | N/A | No | N/A | — |
| Invitation | Accept invitation | Invitee | Accept invitation | Yes | Spinner + `Accepting…` | Yes | Yes | Existing success content | Inline auth error | No | Auth-form inline | P1 |
| Workspace shell | Institution/role selectors | Multi-role users | Switch server-authorized context | Yes | Existing switching state + action toast on failure | Yes | Yes | Context changes | Toast | No | Toast | P1 |
| Workspace shell | Return to platform | Platform admin | Switch context | Yes | Spinner + `Returning…` | Yes | Yes | Platform view | Toast | No | Toast | P1 |
| Workspace shell | Sign out | All authenticated | Revoke session/logout | Yes | Spinner + `Signing out…` | Yes | Yes | Sign-in page | Toast if request fails | No | Toast | P1 |
| Primary navigation | Overview; Setup & access; Academic masters; Students; Exams & registration; Timetable & halls; Duties & attendance; Marks & review; Result publication; Reports & audit; Platform workspace; Student portal | Authorized roles | Client navigation | No | Immediate active-route state | N/A | N/A | Destination page | Page access state | No | Persistent access page | — |
| Platform | Try again | Platform admin | Reload institutions | Yes | Persistent page loading state | Page | Yes while loading | Institution table | Persistent page error | Low (GET) | Page error + retry | P2 |
| Platform | Open workspace | Platform admin | Switch institution | Yes | Spinner + `Opening…` | Yes | Yes | Workspace opens | Toast | No | Toast | P1 |
| Platform | Suspend / Activate | Platform admin | Change institution status | Yes | `Suspending…` / `Activating…` | Yes | Yes | Row refresh + toast | Toast | No | Toast | P0 |
| Platform | Onboard institution | Platform admin | Create institution | Yes | Spinner + `Onboarding…` | Yes | Yes | Form reset/table refresh + toast | Inline native validation or toast | No | Field/native or toast | P0 |
| Overview | Needs-your-attention action | Authorized workspace role | Navigate to next workflow step | No | Immediate navigation | N/A | N/A | Destination page | N/A | No | N/A | — |
| Overview | Try again | Authorized workspace role | Reload dashboard | Yes | Persistent page loading state | Page | Yes while loading | Dashboard | Persistent page error | Low (GET) | Page error + retry | P2 |
| Setup & access | Invite user | Institution admin | Open dialog | No | Dialog opens | N/A | N/A | Dialog | N/A | No | Dialog inline | — |
| Setup & access | Save | Institution admin | Invite user / replace grants | Yes | Spinner + `Saving…` | Yes | Yes | Dialog closes, data refreshes, toast | Inline field error or toast | No | Inline validation / toast | P0 |
| Setup & access | Edit roles | Institution admin | Open dialog | No | Dialog opens | N/A | N/A | Dialog | N/A | No | Dialog inline | — |
| Setup & access | Add another role / Remove role | Institution admin | Edit local form | No | Immediate form update | N/A | N/A | Updated fields | Inline validation | No | Dialog inline | — |
| Setup & access | Activate / Deactivate | Institution admin | Change membership status | Yes | `Activating…` / `Deactivating…`; confirmation retained for deactivate | Yes | Yes | Row refresh + toast | Toast | No | Toast | P0 |
| Setup & access | Refresh / Retry / Previous / Next | Institution admin | Query directory | Yes | Existing page/list loading state | Page | Yes where applicable | List refresh | Persistent page error | Low (GET) | Page error + retry | P2 |
| Academic masters | Add campus/department/program/year/term/cohort/subject | Institution admin | Open create dialog | No | Dialog opens | N/A | N/A | Dialog | N/A | No | Dialog inline | — |
| Academic masters | Edit | Institution admin | Open edit dialog | No | Dialog opens | N/A | N/A | Dialog | N/A | No | Dialog inline | — |
| Academic masters | Save | Institution admin | Create/update master | Yes | Spinner + `Saving…` | Yes | Yes | Dialog closes, table refreshes, toast | Inline 400/422 or toast | No | Inline validation / toast | P0 |
| Academic masters | Refresh / Retry | Institution admin | Query masters | Yes | Existing page loading state | Page | Yes while loading | Table refresh | Persistent page error | Low (GET) | Page error + retry | P2 |
| Students | Import students | Institution admin/controller | Upload + preview CSV | Yes | Spinner + `Validating…` | Yes | Yes | Preview dialog | Toast | No | Toast; row validation inline | P0 |
| Students | Confirm import | Institution admin/controller | Atomic commit | Yes | Spinner + `Importing…` | Yes | Yes | Dialog closes, list refreshes, toast | Toast | No | Toast | P0 |
| Students | Retry / Previous / Next / search | Authorized staff | Query directory | Yes | Existing list/page loading state | Page | Yes where applicable | Directory refresh | Persistent page error | Low (GET) | Page error + retry | P2 |
| Exams | Create exam | Controller/admin | Open dialog | No | Dialog opens | N/A | N/A | Dialog | N/A | No | Dialog/native validation | — |
| Exams | Create exam (dialog submit) | Controller/admin | Create exam/rule v1 | Yes | Spinner + `Creating…` | Yes | Yes | Dialog closes, list refreshes, toast | Native field validation or toast | No | Field/native or toast | P0 |
| Exams | Open registration / Close registration | Controller/admin | Workflow transition | Yes | `Opening…` / `Closing…` | Yes | Yes | State refresh + toast | Toast | No | Toast | P0 |
| Exams | Auto-enrol eligible students | Controller/admin | Bulk enrol | Yes | Spinner + `Enrolling…` | Yes | Yes | Roster refresh + toast | Toast | No | Toast | P0 |
| Exams | Save draft / Submit application | Student | Registration mutation | Yes | `Saving…` / `Submitting…` | Yes | Yes | Registration refresh + toast | Toast | No | Toast | P0 |
| Exams | Approve / Reject | Controller/admin | Registration decision | Yes | `Approving…` / `Rejecting…`; reason prompt retained | Yes | Yes | Decision refresh + toast | Toast | No | Toast | P0 |
| Timetable & halls | Add hall | Controller/admin | Create hall | Yes | Spinner + `Adding…` | Yes | Yes | Hall list refresh + toast | Native field validation or toast | No | Field/native or toast | P0 |
| Timetable & halls | Initialize timetable | Controller/admin | Create exam papers | Yes | Spinner + `Initializing…` for full request | Yes | Yes | Timetable appears + toast | Toast | No | Toast | P0 |
| Timetable & halls | Save time | Controller/admin | Update paper | Yes | Spinner + `Saving…` | Yes | Yes | Paper refresh + toast | Toast | No | Toast | P0 |
| Timetable & halls | Preview allocation | Controller/admin | Validate allocation | Yes | Spinner + `Validating…` | Yes | Yes | Preview state + toast | Toast | No | Toast / persistent blockers | P1 |
| Timetable & halls | Commit seats | Controller/admin | Atomic seat allocation | Yes | Spinner + `Committing…` | Yes | Yes | Allocation refresh + toast | Toast | No | Toast | P0 |
| Timetable & halls | Publish schedule | Controller/admin | Publish schedule | Yes | Spinner + `Publishing…`; blockers remain persistent | Yes | Yes | Revision/state + toast | Toast | No | Toast / blocker banner | P0 |
| Duties & attendance | Assign duty / Assign replacement | Controller/admin | Assign invigilator | Yes | Spinner + `Assigning…` | Yes | Yes | Duty refresh + toast | Toast | No | Toast | P0 |
| Duties & attendance | Accept / Decline | Invigilator | Duty response | Yes | `Accepting…` / `Declining…`; reason prompt retained | Yes | Yes | Duty refresh + toast | Toast | No | Toast | P0 |
| Duties & attendance | Save draft / Submit attendance | Authorized invigilator/controller | Attendance mutation/final submit | Yes | `Saving…` / `Submitting…` | Yes | Yes | Attendance refresh + toast | Toast; blockers persistent | No | Toast / blocker text | P0 |
| Duties & attendance | Reopen with reason | Controller/admin | Reopen submitted attendance | Yes | Spinner + `Reopening…`; reason prompt retained | Yes | Yes | Attendance refresh + toast | Toast | No | Toast | P0 |
| Duties & attendance | Report incident | Authorized invigilator/controller | Create incident | Yes | Spinner + `Reporting…` | Yes | Yes | Incident refresh + toast; input clears only on success | Inline required fields or toast | No | Field/native or toast | P0 |
| Duties & attendance | Clear hold / Retain WITHHELD / Close · no result impact | Controller/admin | Incident disposition | Yes | `Clearing…` / `Retaining…` / `Closing…` | Yes | Yes | Incident refresh + toast | Toast | No | Toast | P0 |
| Marks & review | Save assignment | Controller/admin | Assign examiner | Yes | Spinner + `Saving…` | Yes | Yes | Assignment refresh + toast | Toast | No | Toast | P0 |
| Marks & review | Save draft / Submit for review | Faculty/controller | Marks mutation/submit | Yes | `Saving…` / `Submitting…` | Yes | Yes | Batch refresh + toast | Toast; row constraints remain inline/native | No | Toast / field constraint | P0 |
| Marks & review | Return / Approve batch | Reviewer/controller | Review decision | Yes | `Returning…` / `Approving…`; prompts retained | Yes | Yes | Batch refresh + toast | Toast | No | Toast | P0 |
| Marks & review | Reopen with reason | Controller/admin | Reopen approved batch | Yes | Spinner + `Reopening…`; reason prompt retained | Yes | Yes | Batch refresh + toast | Toast | No | Toast | P0 |
| Results | Compute result run | Controller/admin | Generate immutable run | Yes | Spinner + `Computing…` | Yes | Yes | Run refresh + toast | Toast; blockers persistent | No | Toast / blocker banner | P0 |
| Results | Publish results | Controller/admin | Publish current run | Yes | Spinner + `Publishing…`; confirmation retained | Yes | Yes | Publication refresh + toast | Toast; blockers persistent | No | Toast / blocker banner | P0 |
| Results | Withdraw publication | Controller/admin | Withdraw publication | Yes | Spinner + `Withdrawing…`; confirmation retained | Yes | Yes | Publication refresh + toast | Toast | No | Toast | P0 |
| Reports | Export audit activity / Export CSV | Authorized staff | Fetch and download CSV | Yes | Spinner + `Preparing…` on the selected export only | Yes | Yes | Download + toast | Toast | No | Toast | P1 |
| Student portal documents | View admit card / View grade card / Close / Print | Student | Local document view/print | No server mutation | Immediate view/print dialog | N/A | N/A | Document visible/print dialog | Page-load errors remain page-level | No | Page error | — |

## Notes

- The current implementation has no standalone document-upload or admit-card generation CTA; document access is read-only through the student portal.
- Query controls use the page/list loading treatment. Mutation controls use the shared in-button treatment.
- Original P0 ratings reflect the impact of a repeated business command, not evidence that the API actually committed duplicates. Existing API version/idempotency and transaction protections were preserved.
