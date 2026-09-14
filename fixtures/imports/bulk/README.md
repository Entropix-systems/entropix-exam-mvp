# Bulk student import demo files

These fictional `example.test` files use the current importer contract:
`roll_no,name,email,cohort_code,subject_codes`.

- `northstar-students-upload.csv` is a clean 12-row Northstar preview/commit
  batch for `BSC-CS-S3`.
- `cedar-students-upload.csv` is a clean 12-row Cedar preview/commit batch for
  `CLASS10A`.
- `student-import-reconciliation.csv` is intentionally invalid and demonstrates
  existing roll, unknown subject, invalid email, missing name, unknown cohort,
  and duplicate-in-file reconciliation. Preview it; do not commit it.

The larger baseline seed fixtures remain at
`fixtures/imports/northstar-students-valid.csv` (100 students) and
`fixtures/imports/cedar-students-valid.csv` (20 students). Uploading the clean
files changes the live roster, so use a disposable local database when a later
test depends on the original seeded counts.
