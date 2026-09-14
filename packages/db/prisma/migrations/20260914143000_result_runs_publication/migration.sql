-- B03 Result Runs & Publication: immutable result snapshots and one current publication.

CREATE TABLE "result_runs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "rule_version_id" UUID NOT NULL,
  "input_revision" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "student_count" INTEGER NOT NULL,
  "item_count" INTEGER NOT NULL,
  "pass_count" INTEGER NOT NULL,
  "fail_count" INTEGER NOT NULL,
  "absent_count" INTEGER NOT NULL,
  "withheld_count" INTEGER NOT NULL,
  "computed_by_membership_id" UUID NOT NULL,
  "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "result_runs_input_revision_check" CHECK ("input_revision" >= 0),
  CONSTRAINT "result_runs_counts_check" CHECK (
    "student_count" >= 0 AND "item_count" >= 0 AND
    "pass_count" >= 0 AND "fail_count" >= 0 AND
    "absent_count" >= 0 AND "withheld_count" >= 0 AND
    "student_count" = "pass_count" + "fail_count" + "absent_count" + "withheld_count"
  )
);

CREATE TABLE "result_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "result_run_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "registration_subject_id" UUID NOT NULL,
  "exam_subject_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "subject_code" TEXT NOT NULL,
  "subject_name" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "outcome" TEXT NOT NULL,
  "percentage" DECIMAL(12,4),
  "components" JSONB NOT NULL,
  "grade" TEXT,
  "grade_points" DECIMAL(12,4),
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "result_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "result_items_outcome_check" CHECK ("outcome" IN ('PASS', 'FAIL', 'ABSENT', 'WITHHELD')),
  CONSTRAINT "result_items_credits_check" CHECK ("credits" > 0),
  CONSTRAINT "result_items_hidden_values_check" CHECK (
    "outcome" NOT IN ('ABSENT', 'WITHHELD') OR
    ("percentage" IS NULL AND "grade" IS NULL AND "grade_points" IS NULL)
  )
);

CREATE TABLE "student_results" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "result_run_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "roll_no" TEXT NOT NULL,
  "student_name" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "percentage" DECIMAL(12,4),
  "gpa" DECIMAL(12,4),
  "total_credits" DECIMAL(12,4) NOT NULL,
  "weighted_points" DECIMAL(12,4),
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "student_results_outcome_check" CHECK ("outcome" IN ('PASS', 'FAIL', 'ABSENT', 'WITHHELD')),
  CONSTRAINT "student_results_credits_check" CHECK ("total_credits" > 0),
  CONSTRAINT "student_results_withheld_values_check" CHECK (
    "outcome" <> 'WITHHELD' OR
    ("percentage" IS NULL AND "gpa" IS NULL AND "weighted_points" IS NULL)
  )
);

CREATE TABLE "publications" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "result_run_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "published_by_membership_id" UUID NOT NULL,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawn_by_membership_id" UUID,
  "withdrawn_at" TIMESTAMP(3),
  "withdraw_reason" TEXT,
  CONSTRAINT "publications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "publications_version_check" CHECK ("version" > 0),
  CONSTRAINT "publications_withdraw_reason_check" CHECK (
    "withdraw_reason" IS NULL OR
    ("withdraw_reason" = btrim("withdraw_reason") AND length("withdraw_reason") BETWEEN 5 AND 500)
  ),
  CONSTRAINT "publications_current_state_check" CHECK (
    ("is_current" AND "withdrawn_by_membership_id" IS NULL AND "withdrawn_at" IS NULL AND "withdraw_reason" IS NULL) OR
    (NOT "is_current" AND "withdrawn_by_membership_id" IS NOT NULL AND "withdrawn_at" IS NOT NULL AND "withdraw_reason" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "result_runs_tenant_id_id_key" ON "result_runs"("tenant_id", "id");
CREATE UNIQUE INDEX "result_runs_tenant_id_exam_id_key" ON "result_runs"("tenant_id", "id", "exam_id");
CREATE UNIQUE INDEX "result_runs_tenant_exam_input_revision_key" ON "result_runs"("tenant_id", "exam_id", "input_revision");
CREATE INDEX "result_runs_tenant_id_exam_id_computed_at_idx" ON "result_runs"("tenant_id", "exam_id", "computed_at");
CREATE UNIQUE INDEX "result_items_tenant_id_id_key" ON "result_items"("tenant_id", "id");
CREATE UNIQUE INDEX "result_items_tenant_run_registration_subject_key" ON "result_items"("tenant_id", "result_run_id", "registration_subject_id");
CREATE INDEX "result_items_tenant_id_result_run_id_student_id_idx" ON "result_items"("tenant_id", "result_run_id", "student_id");
CREATE UNIQUE INDEX "student_results_tenant_id_id_key" ON "student_results"("tenant_id", "id");
CREATE UNIQUE INDEX "student_results_tenant_run_student_key" ON "student_results"("tenant_id", "result_run_id", "student_id");
CREATE INDEX "student_results_tenant_id_exam_id_student_id_idx" ON "student_results"("tenant_id", "exam_id", "student_id");
CREATE UNIQUE INDEX "publications_tenant_id_id_key" ON "publications"("tenant_id", "id");
CREATE UNIQUE INDEX "publications_tenant_exam_version_key" ON "publications"("tenant_id", "exam_id", "version");
CREATE UNIQUE INDEX "publications_one_current_per_exam_key" ON "publications"("tenant_id", "exam_id") WHERE "is_current";
CREATE INDEX "publications_tenant_id_exam_id_is_current_idx" ON "publications"("tenant_id", "exam_id", "is_current");

ALTER TABLE "result_runs"
  ADD CONSTRAINT "result_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "result_runs_tenant_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "exam_id") REFERENCES "exams"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "result_runs_tenant_id_rule_version_id_fkey" FOREIGN KEY ("tenant_id", "rule_version_id") REFERENCES "rule_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "result_runs_tenant_id_computed_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "computed_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "result_items"
  ADD CONSTRAINT "result_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "result_items_tenant_id_result_run_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "result_run_id", "exam_id") REFERENCES "result_runs"("tenant_id", "id", "exam_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "result_items_tenant_id_registration_subject_id_exam_subject_id_fkey" FOREIGN KEY ("tenant_id", "registration_subject_id", "exam_subject_id") REFERENCES "registration_subjects"("tenant_id", "id", "exam_subject_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "result_items_tenant_id_student_id_fkey" FOREIGN KEY ("tenant_id", "student_id") REFERENCES "students"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_results"
  ADD CONSTRAINT "student_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "student_results_tenant_id_result_run_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "result_run_id", "exam_id") REFERENCES "result_runs"("tenant_id", "id", "exam_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "student_results_tenant_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "exam_id") REFERENCES "exams"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "student_results_tenant_id_student_id_fkey" FOREIGN KEY ("tenant_id", "student_id") REFERENCES "students"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "publications"
  ADD CONSTRAINT "publications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "publications_tenant_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "exam_id") REFERENCES "exams"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "publications_tenant_id_result_run_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "result_run_id", "exam_id") REFERENCES "result_runs"("tenant_id", "id", "exam_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "publications_tenant_id_published_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "published_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "publications_tenant_id_withdrawn_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "withdrawn_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_result_snapshot_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'result snapshots are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "result_runs_immutable" BEFORE UPDATE OR DELETE ON "result_runs"
FOR EACH ROW EXECUTE FUNCTION prevent_result_snapshot_mutation();
CREATE TRIGGER "result_items_immutable" BEFORE UPDATE OR DELETE ON "result_items"
FOR EACH ROW EXECUTE FUNCTION prevent_result_snapshot_mutation();
CREATE TRIGGER "student_results_immutable" BEFORE UPDATE OR DELETE ON "student_results"
FOR EACH ROW EXECUTE FUNCTION prevent_result_snapshot_mutation();

ALTER TABLE "result_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "result_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "result_runs_tenant_isolation" ON "result_runs" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "result_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "result_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "result_items_tenant_isolation" ON "result_items" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "student_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_results" FORCE ROW LEVEL SECURITY;
CREATE POLICY "student_results_tenant_isolation" ON "student_results" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "publications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "publications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "publications_tenant_isolation" ON "publications" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exam_app') THEN
    GRANT SELECT, INSERT ON "result_runs", "result_items", "student_results" TO exam_app;
    GRANT SELECT, INSERT, UPDATE ON "publications" TO exam_app;
  END IF;
END
$$;
