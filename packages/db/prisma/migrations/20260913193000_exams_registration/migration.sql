-- A03 Exams and Registration: frozen rules, eligibility decisions and stable approved rosters.

CREATE TABLE "rule_versions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "config" JSONB NOT NULL,
  "frozen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exams" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "term_id" UUID NOT NULL,
  "rule_version_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "registration_mode" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "registration_opens_at" TIMESTAMP(3) NOT NULL,
  "registration_closes_at" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_subjects" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registrations" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "controller_eligible" BOOLEAN NOT NULL DEFAULT true,
  "controller_eligibility_reason" TEXT,
  "eligibility_snapshot" JSONB,
  "submitted_at" TIMESTAMP(3),
  "reviewed_by_membership_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "decision_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registration_subjects" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "registration_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "exam_subject_id" UUID NOT NULL,
  "enrolment_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "registration_subjects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "rule_versions"
  ADD CONSTRAINT "rule_versions_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "rule_versions_config_check" CHECK (jsonb_typeof("config") = 'object');
ALTER TABLE "exams"
  ADD CONSTRAINT "exams_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "exams_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160),
  ADD CONSTRAINT "exams_mode_check" CHECK ("registration_mode" IN ('APPLICATION', 'AUTO_ENROL')),
  ADD CONSTRAINT "exams_state_check" CHECK ("state" IN ('DRAFT', 'REGISTRATION_OPEN', 'PREPARATION', 'SCHEDULE_PUBLISHED', 'EVALUATION', 'PUBLISHED', 'CANCELLED')),
  ADD CONSTRAINT "exams_window_check" CHECK ("registration_opens_at" < "registration_closes_at"),
  ADD CONSTRAINT "exams_version_check" CHECK ("version" > 0);
ALTER TABLE "registrations"
  ADD CONSTRAINT "registrations_state_check" CHECK ("state" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  ADD CONSTRAINT "registrations_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "registrations_controller_reason_check" CHECK ("controller_eligible" OR length(btrim("controller_eligibility_reason")) > 0),
  ADD CONSTRAINT "registrations_decision_reason_check" CHECK ("decision_reason" IS NULL OR length(btrim("decision_reason")) > 0);

CREATE UNIQUE INDEX "rule_versions_tenant_id_id_key" ON "rule_versions"("tenant_id", "id");
CREATE UNIQUE INDEX "rule_versions_tenant_version_key" ON "rule_versions"("tenant_id", "version");
CREATE INDEX "rule_versions_tenant_id_idx" ON "rule_versions"("tenant_id");
CREATE UNIQUE INDEX "exams_tenant_id_id_key" ON "exams"("tenant_id", "id");
CREATE UNIQUE INDEX "exams_tenant_term_code_key" ON "exams"("tenant_id", "term_id", "code");
CREATE INDEX "exams_tenant_id_term_id_idx" ON "exams"("tenant_id", "term_id");
CREATE UNIQUE INDEX "exam_subjects_tenant_id_id_key" ON "exam_subjects"("tenant_id", "id");
CREATE UNIQUE INDEX "exam_subjects_tenant_id_exam_id_key" ON "exam_subjects"("tenant_id", "id", "exam_id");
CREATE UNIQUE INDEX "exam_subjects_tenant_exam_subject_key" ON "exam_subjects"("tenant_id", "exam_id", "subject_id");
CREATE INDEX "exam_subjects_tenant_id_subject_id_idx" ON "exam_subjects"("tenant_id", "subject_id");
CREATE UNIQUE INDEX "registrations_tenant_id_id_key" ON "registrations"("tenant_id", "id");
CREATE UNIQUE INDEX "registrations_tenant_id_exam_id_key" ON "registrations"("tenant_id", "id", "exam_id");
CREATE UNIQUE INDEX "registrations_tenant_exam_student_key" ON "registrations"("tenant_id", "exam_id", "student_id");
CREATE INDEX "registrations_tenant_id_state_idx" ON "registrations"("tenant_id", "state");
CREATE UNIQUE INDEX "registration_subjects_tenant_id_id_key" ON "registration_subjects"("tenant_id", "id");
CREATE UNIQUE INDEX "registration_subjects_tenant_registration_exam_subject_key" ON "registration_subjects"("tenant_id", "registration_id", "exam_subject_id");
CREATE INDEX "registration_subjects_tenant_id_exam_id_exam_subject_id_idx" ON "registration_subjects"("tenant_id", "exam_id", "exam_subject_id");
CREATE UNIQUE INDEX "enrolments_tenant_id_id_key" ON "enrolments"("tenant_id", "id");

ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exams"
  ADD CONSTRAINT "exams_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "exams_tenant_id_term_id_fkey" FOREIGN KEY ("tenant_id", "term_id") REFERENCES "terms"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "exams_tenant_id_rule_version_id_fkey" FOREIGN KEY ("tenant_id", "rule_version_id") REFERENCES "rule_versions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_subjects"
  ADD CONSTRAINT "exam_subjects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "exam_subjects_tenant_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "exam_id") REFERENCES "exams"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "exam_subjects_tenant_id_subject_id_fkey" FOREIGN KEY ("tenant_id", "subject_id") REFERENCES "subjects"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations"
  ADD CONSTRAINT "registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "registrations_tenant_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "exam_id") REFERENCES "exams"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "registrations_tenant_id_student_id_fkey" FOREIGN KEY ("tenant_id", "student_id") REFERENCES "students"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "registrations_tenant_id_reviewed_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "reviewed_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registration_subjects"
  ADD CONSTRAINT "registration_subjects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "registration_subjects_tenant_registration_exam_fkey" FOREIGN KEY ("tenant_id", "registration_id", "exam_id") REFERENCES "registrations"("tenant_id", "id", "exam_id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "registration_subjects_tenant_exam_subject_exam_fkey" FOREIGN KEY ("tenant_id", "exam_subject_id", "exam_id") REFERENCES "exam_subjects"("tenant_id", "id", "exam_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "registration_subjects_tenant_enrolment_fkey" FOREIGN KEY ("tenant_id", "enrolment_id") REFERENCES "enrolments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_rule_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."tenant_id" <> OLD."tenant_id" OR NEW."version" <> OLD."version" OR NEW."config" <> OLD."config" OR OLD."frozen_at" IS NOT NULL OR NEW."frozen_at" IS NULL THEN
    RAISE EXCEPTION 'RuleVersion is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "rule_versions_immutable" BEFORE UPDATE ON "rule_versions" FOR EACH ROW EXECUTE FUNCTION prevent_rule_version_mutation();

ALTER TABLE "rule_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rule_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "rule_versions_tenant_isolation" ON "rule_versions" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exams" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exams_tenant_isolation" ON "exams" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "exam_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_subjects" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exam_subjects_tenant_isolation" ON "exam_subjects" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registrations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "registrations_tenant_isolation" ON "registrations" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "registration_subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registration_subjects" FORCE ROW LEVEL SECURITY;
CREATE POLICY "registration_subjects_tenant_isolation" ON "registration_subjects" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
