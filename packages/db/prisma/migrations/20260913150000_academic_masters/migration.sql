-- A01 Academic Masters: tenant-safe academic hierarchy for the demo journey.

CREATE TABLE "campuses" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "departments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "programs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "academic_years" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "terms" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "academic_year_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE NOT NULL,
  "sequence" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "terms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cohorts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "term_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cohorts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subjects" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "program_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "campuses"
  ADD CONSTRAINT "campuses_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "campuses_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160);
ALTER TABLE "departments"
  ADD CONSTRAINT "departments_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "departments_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160);
ALTER TABLE "programs"
  ADD CONSTRAINT "programs_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "programs_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160);
ALTER TABLE "academic_years"
  ADD CONSTRAINT "academic_years_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "academic_years_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160),
  ADD CONSTRAINT "academic_years_dates_check" CHECK ("starts_on" <= "ends_on");
ALTER TABLE "terms"
  ADD CONSTRAINT "terms_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "terms_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160),
  ADD CONSTRAINT "terms_dates_check" CHECK ("starts_on" <= "ends_on"),
  ADD CONSTRAINT "terms_sequence_check" CHECK ("sequence" > 0);
ALTER TABLE "cohorts"
  ADD CONSTRAINT "cohorts_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "cohorts_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160);
ALTER TABLE "subjects"
  ADD CONSTRAINT "subjects_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  ADD CONSTRAINT "subjects_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160),
  ADD CONSTRAINT "subjects_credits_check" CHECK ("credits" BETWEEN 1 AND 50);

CREATE UNIQUE INDEX "campuses_tenant_id_id_key" ON "campuses"("tenant_id", "id");
CREATE UNIQUE INDEX "campuses_tenant_code_key" ON "campuses"("tenant_id", "code");
CREATE INDEX "campuses_tenant_id_idx" ON "campuses"("tenant_id");

CREATE UNIQUE INDEX "departments_tenant_id_id_key" ON "departments"("tenant_id", "id");
CREATE UNIQUE INDEX "departments_tenant_campus_code_key" ON "departments"("tenant_id", "campus_id", "code");
CREATE INDEX "departments_tenant_id_idx" ON "departments"("tenant_id");
CREATE INDEX "departments_tenant_id_campus_id_idx" ON "departments"("tenant_id", "campus_id");

CREATE UNIQUE INDEX "programs_tenant_id_id_key" ON "programs"("tenant_id", "id");
CREATE UNIQUE INDEX "programs_tenant_department_code_key" ON "programs"("tenant_id", "department_id", "code");
CREATE INDEX "programs_tenant_id_idx" ON "programs"("tenant_id");
CREATE INDEX "programs_tenant_id_department_id_idx" ON "programs"("tenant_id", "department_id");

CREATE UNIQUE INDEX "academic_years_tenant_id_id_key" ON "academic_years"("tenant_id", "id");
CREATE UNIQUE INDEX "academic_years_tenant_code_key" ON "academic_years"("tenant_id", "code");
CREATE INDEX "academic_years_tenant_id_idx" ON "academic_years"("tenant_id");

CREATE UNIQUE INDEX "terms_tenant_id_id_key" ON "terms"("tenant_id", "id");
CREATE UNIQUE INDEX "terms_tenant_program_year_code_key" ON "terms"("tenant_id", "program_id", "academic_year_id", "code");
CREATE UNIQUE INDEX "terms_tenant_program_year_sequence_key" ON "terms"("tenant_id", "program_id", "academic_year_id", "sequence");
CREATE INDEX "terms_tenant_id_idx" ON "terms"("tenant_id");
CREATE INDEX "terms_tenant_id_program_id_idx" ON "terms"("tenant_id", "program_id");
CREATE INDEX "terms_tenant_id_academic_year_id_idx" ON "terms"("tenant_id", "academic_year_id");

CREATE UNIQUE INDEX "cohorts_tenant_id_id_key" ON "cohorts"("tenant_id", "id");
CREATE UNIQUE INDEX "cohorts_tenant_term_code_key" ON "cohorts"("tenant_id", "term_id", "code");
CREATE INDEX "cohorts_tenant_id_idx" ON "cohorts"("tenant_id");
CREATE INDEX "cohorts_tenant_id_term_id_idx" ON "cohorts"("tenant_id", "term_id");

CREATE UNIQUE INDEX "subjects_tenant_id_id_key" ON "subjects"("tenant_id", "id");
CREATE UNIQUE INDEX "subjects_tenant_program_code_key" ON "subjects"("tenant_id", "program_id", "code");
CREATE INDEX "subjects_tenant_id_idx" ON "subjects"("tenant_id");
CREATE INDEX "subjects_tenant_id_program_id_idx" ON "subjects"("tenant_id", "program_id");

ALTER TABLE "campuses"
  ADD CONSTRAINT "campuses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "departments"
  ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "departments_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "programs"
  ADD CONSTRAINT "programs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "programs_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "academic_years"
  ADD CONSTRAINT "academic_years_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "terms"
  ADD CONSTRAINT "terms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "terms_tenant_id_program_id_fkey" FOREIGN KEY ("tenant_id", "program_id") REFERENCES "programs"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "terms_tenant_id_academic_year_id_fkey" FOREIGN KEY ("tenant_id", "academic_year_id") REFERENCES "academic_years"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cohorts"
  ADD CONSTRAINT "cohorts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "cohorts_tenant_id_term_id_fkey" FOREIGN KEY ("tenant_id", "term_id") REFERENCES "terms"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subjects"
  ADD CONSTRAINT "subjects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subjects_tenant_id_program_id_fkey" FOREIGN KEY ("tenant_id", "program_id") REFERENCES "programs"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "campuses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campuses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "campuses_tenant_isolation" ON "campuses"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "departments_tenant_isolation" ON "departments"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "programs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "programs_tenant_isolation" ON "programs"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_years" FORCE ROW LEVEL SECURITY;
CREATE POLICY "academic_years_tenant_isolation" ON "academic_years"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terms" FORCE ROW LEVEL SECURITY;
CREATE POLICY "terms_tenant_isolation" ON "terms"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "cohorts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cohorts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cohorts_tenant_isolation" ON "cohorts"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subjects" FORCE ROW LEVEL SECURITY;
CREATE POLICY "subjects_tenant_isolation" ON "subjects"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
