# Examination ERP MVP — Student Import Contract

Status: FROZEN FOR THE THREE-DAY MVP

## Supported formats

The MVP accepts:

- CSV
- XLSX

The D0 acceptance fixture uses CSV.

## Required columns

- roll_no
- name
- email
- cohort_code
- subject_codes

subject_codes uses a pipe-delimited list in CSV.

Example row:

NS26001,Northstar Student 001,student.001@northstar.example.test,BSC-CS-S3,CS301|MA301|EN301

## Preview validation

Preview must identify:

- duplicate roll numbers
- unknown cohort codes
- unknown subject codes
- missing required values
- malformed required values

Every validation error retains the source row number.

## Commit semantics

Student create import is atomic.

If any row is invalid:

- no student from the batch is committed
- accepted and rejected counts reconcile to the source file
- the operator corrects and reuploads the file

Existing roll numbers are rejected by create import.

Editing an existing student's enrolments is a separate explicit workflow.

## Retry semantics

Replaying an already committed valid import must not create duplicate students.

## Canonical fixtures

- student-import-template.csv
- northstar-students-valid.csv
- cedar-students-valid.csv
- student-import-invalid.csv
