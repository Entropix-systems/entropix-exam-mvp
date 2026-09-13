-- A02 Students, Faculty, Enrolments and retry-safe student imports.

CREATE TABLE "students" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "cohort_id" UUID NOT NULL,
  "roll_no" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "faculty" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "faculty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enrolments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "cohort_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "enrolments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_imports" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "content_hash" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "row_count" INTEGER NOT NULL,
  "created_count" INTEGER NOT NULL,
  "enrolment_count" INTEGER NOT NULL,
  "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_imports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "students"
  ADD CONSTRAINT "students_roll_no_check" CHECK ("roll_no" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "students_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160),
  ADD CONSTRAINT "students_email_check" CHECK ("email" = lower(btrim("email")) AND length("email") BETWEEN 3 AND 320),
  ADD CONSTRAINT "students_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE "faculty"
  ADD CONSTRAINT "faculty_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "faculty_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160),
  ADD CONSTRAINT "faculty_email_check" CHECK ("email" = lower(btrim("email")) AND length("email") BETWEEN 3 AND 320),
  ADD CONSTRAINT "faculty_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE "enrolments"
  ADD CONSTRAINT "enrolments_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE'));
ALTER TABLE "student_imports"
  ADD CONSTRAINT "student_imports_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "student_imports_file_name_check" CHECK (length(btrim("file_name")) BETWEEN 1 AND 255),
  ADD CONSTRAINT "student_imports_counts_check" CHECK ("row_count" > 0 AND "created_count" >= 0 AND "enrolment_count" >= 0);

CREATE UNIQUE INDEX "students_tenant_id_id_key" ON "students"("tenant_id", "id");
CREATE UNIQUE INDEX "students_tenant_id_cohort_id_key" ON "students"("tenant_id", "id", "cohort_id");
CREATE UNIQUE INDEX "students_tenant_membership_key" ON "students"("tenant_id", "membership_id");
CREATE UNIQUE INDEX "students_tenant_roll_no_key" ON "students"("tenant_id", "roll_no");
CREATE INDEX "students_tenant_id_cohort_id_idx" ON "students"("tenant_id", "cohort_id");

CREATE UNIQUE INDEX "faculty_tenant_id_id_key" ON "faculty"("tenant_id", "id");
CREATE UNIQUE INDEX "faculty_tenant_membership_key" ON "faculty"("tenant_id", "membership_id");
CREATE UNIQUE INDEX "faculty_tenant_code_key" ON "faculty"("tenant_id", "code");
CREATE INDEX "faculty_tenant_id_department_id_idx" ON "faculty"("tenant_id", "department_id");

CREATE UNIQUE INDEX "enrolments_tenant_student_subject_cohort_key" ON "enrolments"("tenant_id", "student_id", "subject_id", "cohort_id");
CREATE INDEX "enrolments_tenant_id_cohort_id_subject_id_idx" ON "enrolments"("tenant_id", "cohort_id", "subject_id");

CREATE UNIQUE INDEX "student_imports_tenant_id_id_key" ON "student_imports"("tenant_id", "id");
CREATE UNIQUE INDEX "student_imports_tenant_content_hash_key" ON "student_imports"("tenant_id", "content_hash");
CREATE INDEX "student_imports_tenant_id_committed_at_idx" ON "student_imports"("tenant_id", "committed_at");

ALTER TABLE "students"
  ADD CONSTRAINT "students_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "students_tenant_id_membership_id_fkey" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "students_tenant_id_cohort_id_fkey" FOREIGN KEY ("tenant_id", "cohort_id") REFERENCES "cohorts"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "faculty"
  ADD CONSTRAINT "faculty_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "faculty_tenant_id_membership_id_fkey" FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "faculty_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrolments"
  ADD CONSTRAINT "enrolments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "enrolments_tenant_id_student_id_cohort_id_fkey" FOREIGN KEY ("tenant_id", "student_id", "cohort_id") REFERENCES "students"("tenant_id", "id", "cohort_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "enrolments_tenant_id_cohort_id_fkey" FOREIGN KEY ("tenant_id", "cohort_id") REFERENCES "cohorts"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "enrolments_tenant_id_subject_id_fkey" FOREIGN KEY ("tenant_id", "subject_id") REFERENCES "subjects"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_imports"
  ADD CONSTRAINT "student_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;
CREATE POLICY "students_tenant_isolation" ON "students"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "faculty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty" FORCE ROW LEVEL SECURITY;
CREATE POLICY "faculty_tenant_isolation" ON "faculty"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "enrolments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrolments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "enrolments_tenant_isolation" ON "enrolments"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "student_imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_imports" FORCE ROW LEVEL SECURITY;
CREATE POLICY "student_imports_tenant_isolation" ON "student_imports"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
