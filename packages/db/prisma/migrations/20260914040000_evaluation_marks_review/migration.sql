-- B02 Marks Entry & Independent Review: assignment-scoped, versioned evaluation persistence.

ALTER TABLE "exams"
  ADD COLUMN "input_revision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "evaluation_assignments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_subject_id" UUID NOT NULL,
  "faculty_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "assigned_by_membership_id" UUID NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evaluation_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "evaluation_assignments_version_check" CHECK ("version" > 0)
);

CREATE TABLE "marks_batches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_subject_id" UUID NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "submitted_by_membership_id" UUID,
  "submitted_at" TIMESTAMP(3),
  "reviewed_by_membership_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_reason" TEXT,
  "reopened_by_membership_id" UUID,
  "reopened_at" TIMESTAMP(3),
  "reopen_reason" TEXT,
  "history" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "marks_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marks_batches_state_check" CHECK ("state" IN ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED')),
  CONSTRAINT "marks_batches_version_check" CHECK ("version" > 0),
  CONSTRAINT "marks_batches_review_reason_check" CHECK ("review_reason" IS NULL OR ("review_reason" = btrim("review_reason") AND length("review_reason") BETWEEN 5 AND 500)),
  CONSTRAINT "marks_batches_reopen_reason_check" CHECK ("reopen_reason" IS NULL OR ("reopen_reason" = btrim("reopen_reason") AND length("reopen_reason") BETWEEN 5 AND 500))
);

CREATE TABLE "marks" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "marks_batch_id" UUID NOT NULL,
  "exam_subject_id" UUID NOT NULL,
  "registration_subject_id" UUID NOT NULL,
  "component" TEXT NOT NULL,
  "value" DECIMAL(12,4) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "marks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marks_component_check" CHECK ("component" IN ('FINAL', 'INTERNAL', 'EXTERNAL')),
  CONSTRAINT "marks_value_check" CHECK ("value" >= 0),
  CONSTRAINT "marks_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "evaluation_assignments_tenant_id_id_key" ON "evaluation_assignments"("tenant_id", "id");
CREATE UNIQUE INDEX "evaluation_assignments_tenant_exam_subject_key" ON "evaluation_assignments"("tenant_id", "exam_subject_id");
CREATE INDEX "evaluation_assignments_tenant_id_faculty_id_idx" ON "evaluation_assignments"("tenant_id", "faculty_id");
CREATE UNIQUE INDEX "marks_batches_tenant_id_id_key" ON "marks_batches"("tenant_id", "id");
CREATE UNIQUE INDEX "marks_batches_tenant_id_exam_subject_key" ON "marks_batches"("tenant_id", "id", "exam_subject_id");
CREATE UNIQUE INDEX "marks_batches_tenant_exam_subject_key" ON "marks_batches"("tenant_id", "exam_subject_id");
CREATE INDEX "marks_batches_tenant_id_state_idx" ON "marks_batches"("tenant_id", "state");
CREATE UNIQUE INDEX "marks_tenant_id_id_key" ON "marks"("tenant_id", "id");
CREATE UNIQUE INDEX "marks_tenant_batch_registration_component_key" ON "marks"("tenant_id", "marks_batch_id", "registration_subject_id", "component");
CREATE INDEX "marks_tenant_id_exam_subject_id_registration_subject_id_idx" ON "marks"("tenant_id", "exam_subject_id", "registration_subject_id");

ALTER TABLE "evaluation_assignments"
  ADD CONSTRAINT "evaluation_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "evaluation_assignments_tenant_id_exam_subject_id_fkey" FOREIGN KEY ("tenant_id", "exam_subject_id") REFERENCES "exam_subjects"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "evaluation_assignments_tenant_id_faculty_id_fkey" FOREIGN KEY ("tenant_id", "faculty_id") REFERENCES "faculty"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "evaluation_assignments_tenant_id_assigned_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "assigned_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marks_batches"
  ADD CONSTRAINT "marks_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "marks_batches_tenant_id_exam_subject_id_fkey" FOREIGN KEY ("tenant_id", "exam_subject_id") REFERENCES "exam_subjects"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "marks_batches_tenant_id_submitted_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "submitted_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "marks_batches_tenant_id_reviewed_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "marks_batches_tenant_id_reopened_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "reopened_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marks"
  ADD CONSTRAINT "marks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "marks_tenant_id_marks_batch_id_exam_subject_id_fkey" FOREIGN KEY ("tenant_id", "marks_batch_id", "exam_subject_id") REFERENCES "marks_batches"("tenant_id", "id", "exam_subject_id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "marks_tenant_id_registration_subject_id_exam_subject_id_fkey" FOREIGN KEY ("tenant_id", "registration_subject_id", "exam_subject_id") REFERENCES "registration_subjects"("tenant_id", "id", "exam_subject_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "marks_tenant_id_updated_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evaluation_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evaluation_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evaluation_assignments_tenant_isolation" ON "evaluation_assignments" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "marks_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marks_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY "marks_batches_tenant_isolation" ON "marks_batches" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "marks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "marks_tenant_isolation" ON "marks" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exam_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "evaluation_assignments", "marks_batches", "marks" TO exam_app;
  END IF;
END
$$;
