# Full-application demo browser evidence

Captured on 2026-09-14 against the guarded disposable-local
`full-application-v1` dataset. The browser used real API authentication and
server-resolved roles; no fixture interception was used.

| File | Evidence |
| --- | --- |
| `01-student-pass-portal.png` | Cedar Student 03 sees only their approved historical registration, timetable, PASS result, and current private document actions. |
| `02-student-admit-card.png` | Cedar Student 03 printable admit card with historical sittings, hall/seat, and schedule revision. |
| `03-student-pass-grade-card.png` | Cedar Student 03 printable PASS grade card; the print-to-PDF check produced exactly one page. |
| `04-controller-timetable-halls.png` | Cedar controller view preserves future `ANNUAL-2026`, 15-17 September sittings, revision 1, and hall allocation. |
| `05-controller-result-publication.png` | Cedar historical publication is READY/PUBLISHED v1 with 20 students, 3/3 approved subjects, 60 subject outcomes, and one held student. |
| `06-faculty-marks-review.png` | Assigned Northstar faculty sees approved component marks for the historical subject roster. |
| `07-invigilator-duty-attendance.png` | Server-authorized invigilator context shows the accepted historical sitting roster and submitted attendance. |
| `08-student-withheld-privacy.png` | Cedar Student 02 sees the WITHHELD message with no marks, percentage, GPA, or grade-card action. |

The final browser console contained only Vite/React development informational
messages and no page errors. Screenshots contain no passwords, tokens, cookies,
database details, or developer tooling.
