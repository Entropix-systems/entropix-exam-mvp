-- A04 Timetable, Halls & Seats: persisted papers, deterministic room allocation and schedule revisions.

ALTER TABLE "exams" ADD COLUMN "schedule_revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "exams" ADD CONSTRAINT "exams_schedule_revision_check" CHECK ("schedule_revision" >= 0);
CREATE UNIQUE INDEX "registration_subjects_tenant_id_exam_subject_id_key"
  ON "registration_subjects"("tenant_id", "id", "exam_subject_id");

CREATE TABLE "exam_papers" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_id" UUID NOT NULL,
  "exam_subject_id" UUID NOT NULL,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "exam_papers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exam_papers_time_check" CHECK (
    ("starts_at" IS NULL AND "ends_at" IS NULL)
    OR ("starts_at" IS NOT NULL AND "ends_at" IS NOT NULL AND "starts_at" < "ends_at")
  ),
  CONSTRAINT "exam_papers_version_check" CHECK ("version" > 0)
);

CREATE TABLE "halls" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "halls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "halls_code_check" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  CONSTRAINT "halls_name_check" CHECK ("name" = btrim("name") AND length("name") BETWEEN 1 AND 160),
  CONSTRAINT "halls_capacity_check" CHECK ("capacity" > 0),
  CONSTRAINT "halls_version_check" CHECK ("version" > 0)
);

CREATE TABLE "hall_sittings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_paper_id" UUID NOT NULL,
  "hall_id" UUID NOT NULL,
  "room_order" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hall_sittings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hall_sittings_room_order_check" CHECK ("room_order" > 0),
  CONSTRAINT "hall_sittings_version_check" CHECK ("version" > 0)
);

CREATE TABLE "seat_assignments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exam_paper_id" UUID NOT NULL,
  "exam_subject_id" UUID NOT NULL,
  "hall_sitting_id" UUID NOT NULL,
  "registration_subject_id" UUID NOT NULL,
  "seat_number" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seat_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seat_assignments_seat_number_check" CHECK ("seat_number" > 0)
);

CREATE UNIQUE INDEX "exam_papers_tenant_id_id_key" ON "exam_papers"("tenant_id", "id");
CREATE UNIQUE INDEX "exam_papers_tenant_id_exam_subject_id_key" ON "exam_papers"("tenant_id", "id", "exam_subject_id");
CREATE UNIQUE INDEX "exam_papers_tenant_exam_subject_exam_key" ON "exam_papers"("tenant_id", "exam_subject_id", "exam_id");
CREATE UNIQUE INDEX "exam_papers_tenant_exam_subject_key" ON "exam_papers"("tenant_id", "exam_subject_id");
CREATE INDEX "exam_papers_tenant_id_exam_id_starts_at_ends_at_idx" ON "exam_papers"("tenant_id", "exam_id", "starts_at", "ends_at");
CREATE UNIQUE INDEX "halls_tenant_id_id_key" ON "halls"("tenant_id", "id");
CREATE UNIQUE INDEX "halls_tenant_campus_code_key" ON "halls"("tenant_id", "campus_id", "code");
CREATE INDEX "halls_tenant_id_campus_id_idx" ON "halls"("tenant_id", "campus_id");
CREATE UNIQUE INDEX "hall_sittings_tenant_id_id_key" ON "hall_sittings"("tenant_id", "id");
CREATE UNIQUE INDEX "hall_sittings_tenant_id_exam_paper_id_key" ON "hall_sittings"("tenant_id", "id", "exam_paper_id");
CREATE UNIQUE INDEX "hall_sittings_tenant_paper_hall_key" ON "hall_sittings"("tenant_id", "exam_paper_id", "hall_id");
CREATE UNIQUE INDEX "hall_sittings_tenant_paper_room_order_key" ON "hall_sittings"("tenant_id", "exam_paper_id", "room_order");
CREATE INDEX "hall_sittings_tenant_id_hall_id_idx" ON "hall_sittings"("tenant_id", "hall_id");
CREATE UNIQUE INDEX "seat_assignments_tenant_id_id_key" ON "seat_assignments"("tenant_id", "id");
CREATE UNIQUE INDEX "seat_assignments_tenant_paper_registration_subject_key" ON "seat_assignments"("tenant_id", "exam_paper_id", "registration_subject_id");
CREATE UNIQUE INDEX "seat_assignments_tenant_sitting_seat_key" ON "seat_assignments"("tenant_id", "hall_sitting_id", "seat_number");
CREATE INDEX "seat_assignments_tenant_id_registration_subject_id_idx" ON "seat_assignments"("tenant_id", "registration_subject_id");

ALTER TABLE "exam_papers"
  ADD CONSTRAINT "exam_papers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "exam_papers_tenant_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "exam_id") REFERENCES "exams"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "exam_papers_tenant_id_exam_subject_id_exam_id_fkey" FOREIGN KEY ("tenant_id", "exam_subject_id", "exam_id") REFERENCES "exam_subjects"("tenant_id", "id", "exam_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "halls"
  ADD CONSTRAINT "halls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "halls_tenant_id_campus_id_fkey" FOREIGN KEY ("tenant_id", "campus_id") REFERENCES "campuses"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hall_sittings"
  ADD CONSTRAINT "hall_sittings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "hall_sittings_tenant_id_exam_paper_id_fkey" FOREIGN KEY ("tenant_id", "exam_paper_id") REFERENCES "exam_papers"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "hall_sittings_tenant_id_hall_id_fkey" FOREIGN KEY ("tenant_id", "hall_id") REFERENCES "halls"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seat_assignments"
  ADD CONSTRAINT "seat_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "seat_assignments_tenant_id_exam_paper_id_exam_subject_id_fkey" FOREIGN KEY ("tenant_id", "exam_paper_id", "exam_subject_id") REFERENCES "exam_papers"("tenant_id", "id", "exam_subject_id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "seat_assignments_tenant_id_hall_sitting_id_exam_paper_id_fkey" FOREIGN KEY ("tenant_id", "hall_sitting_id", "exam_paper_id") REFERENCES "hall_sittings"("tenant_id", "id", "exam_paper_id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "seat_assignments_tenant_id_registration_subject_id_exam_subject_id_fkey" FOREIGN KEY ("tenant_id", "registration_subject_id", "exam_subject_id") REFERENCES "registration_subjects"("tenant_id", "id", "exam_subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exam_papers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_papers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exam_papers_tenant_isolation" ON "exam_papers" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "halls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "halls" FORCE ROW LEVEL SECURITY;
CREATE POLICY "halls_tenant_isolation" ON "halls" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "hall_sittings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hall_sittings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "hall_sittings_tenant_isolation" ON "hall_sittings" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "seat_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seat_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "seat_assignments_tenant_isolation" ON "seat_assignments" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exam_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "exam_papers", "halls", "hall_sittings", "seat_assignments" TO exam_app;
  END IF;
END
$$;
