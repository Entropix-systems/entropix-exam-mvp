-- A05 Duties, Attendance & Incidents: assignment-scoped conduct and authoritative result inputs.

CREATE TABLE "duties" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "hall_sitting_id" UUID NOT NULL,
  "faculty_id" UUID NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "decline_reason" TEXT,
  "replaces_duty_id" UUID,
  "assigned_by_membership_id" UUID NOT NULL,
  "responded_by_membership_id" UUID,
  "responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "duties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "duties_state_check" CHECK ("state" IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  CONSTRAINT "duties_version_check" CHECK ("version" > 0),
  CONSTRAINT "duties_decline_reason_check" CHECK ("decline_reason" IS NULL OR ("decline_reason" = btrim("decline_reason") AND length("decline_reason") BETWEEN 5 AND 500))
);

CREATE TABLE "attendance_batches" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "hall_sitting_id" UUID NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "submitted_by_membership_id" UUID,
  "submitted_at" TIMESTAMP(3),
  "reopened_by_membership_id" UUID,
  "reopened_at" TIMESTAMP(3),
  "reopen_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_batches_state_check" CHECK ("state" IN ('DRAFT', 'SUBMITTED')),
  CONSTRAINT "attendance_batches_version_check" CHECK ("version" > 0),
  CONSTRAINT "attendance_batches_reopen_reason_check" CHECK ("reopen_reason" IS NULL OR ("reopen_reason" = btrim("reopen_reason") AND length("reopen_reason") BETWEEN 5 AND 500))
);

CREATE TABLE "attendance" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "attendance_batch_id" UUID NOT NULL,
  "hall_sitting_id" UUID NOT NULL,
  "seat_assignment_id" UUID NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'NOT_MARKED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_membership_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_state_check" CHECK ("state" IN ('NOT_MARKED', 'PRESENT', 'ABSENT', 'LATE')),
  CONSTRAINT "attendance_version_check" CHECK ("version" > 0)
);

CREATE TABLE "incidents" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "hall_sitting_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "disposition" TEXT NOT NULL DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_membership_id" UUID NOT NULL,
  "disposed_by_membership_id" UUID,
  "disposition_reason" TEXT,
  "disposed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "incidents_kind_check" CHECK ("kind" IN ('STUDENT', 'HALL')),
  CONSTRAINT "incidents_disposition_check" CHECK ("disposition" IN ('OPEN', 'CLEARED', 'RETAIN_WITHHELD', 'NO_RESULT_IMPACT')),
  CONSTRAINT "incidents_description_check" CHECK ("description" = btrim("description") AND length("description") BETWEEN 5 AND 1000),
  CONSTRAINT "incidents_version_check" CHECK ("version" > 0),
  CONSTRAINT "incidents_disposition_reason_check" CHECK ("disposition_reason" IS NULL OR ("disposition_reason" = btrim("disposition_reason") AND length("disposition_reason") BETWEEN 5 AND 500))
);

CREATE TABLE "incident_students" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "incident_id" UUID NOT NULL,
  "registration_subject_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "incident_students_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "duties_tenant_id_id_key" ON "duties"("tenant_id", "id");
CREATE UNIQUE INDEX "duties_tenant_replaces_key" ON "duties"("tenant_id", "replaces_duty_id");
CREATE INDEX "duties_tenant_id_hall_sitting_id_state_idx" ON "duties"("tenant_id", "hall_sitting_id", "state");
CREATE INDEX "duties_tenant_id_faculty_id_state_idx" ON "duties"("tenant_id", "faculty_id", "state");
CREATE UNIQUE INDEX "duties_one_active_faculty_per_sitting_key" ON "duties"("tenant_id", "hall_sitting_id", "faculty_id") WHERE "state" IN ('PENDING', 'ACCEPTED');
CREATE UNIQUE INDEX "attendance_batches_tenant_id_id_key" ON "attendance_batches"("tenant_id", "id");
CREATE UNIQUE INDEX "attendance_batches_tenant_id_sitting_key" ON "attendance_batches"("tenant_id", "id", "hall_sitting_id");
CREATE UNIQUE INDEX "attendance_batches_tenant_sitting_key" ON "attendance_batches"("tenant_id", "hall_sitting_id");
CREATE UNIQUE INDEX "attendance_tenant_id_id_key" ON "attendance"("tenant_id", "id");
CREATE UNIQUE INDEX "attendance_tenant_seat_key" ON "attendance"("tenant_id", "seat_assignment_id");
CREATE INDEX "attendance_tenant_id_hall_sitting_id_state_idx" ON "attendance"("tenant_id", "hall_sitting_id", "state");
CREATE UNIQUE INDEX "incidents_tenant_id_id_key" ON "incidents"("tenant_id", "id");
CREATE INDEX "incidents_tenant_id_hall_sitting_id_disposition_idx" ON "incidents"("tenant_id", "hall_sitting_id", "disposition");
CREATE UNIQUE INDEX "incident_students_tenant_id_id_key" ON "incident_students"("tenant_id", "id");
CREATE UNIQUE INDEX "incident_students_tenant_incident_registration_key" ON "incident_students"("tenant_id", "incident_id", "registration_subject_id");
CREATE INDEX "incident_students_tenant_id_registration_subject_id_idx" ON "incident_students"("tenant_id", "registration_subject_id");

ALTER TABLE "duties"
  ADD CONSTRAINT "duties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "duties_tenant_id_hall_sitting_id_fkey" FOREIGN KEY ("tenant_id", "hall_sitting_id") REFERENCES "hall_sittings"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "duties_tenant_id_faculty_id_fkey" FOREIGN KEY ("tenant_id", "faculty_id") REFERENCES "faculty"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "duties_tenant_id_assigned_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "assigned_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "duties_tenant_id_responded_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "responded_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "duties_tenant_id_replaces_duty_id_fkey" FOREIGN KEY ("tenant_id", "replaces_duty_id") REFERENCES "duties"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance_batches"
  ADD CONSTRAINT "attendance_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_batches_tenant_id_hall_sitting_id_fkey" FOREIGN KEY ("tenant_id", "hall_sitting_id") REFERENCES "hall_sittings"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_batches_tenant_id_submitted_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "submitted_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_batches_tenant_id_reopened_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "reopened_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_tenant_id_batch_id_sitting_id_fkey" FOREIGN KEY ("tenant_id", "attendance_batch_id", "hall_sitting_id") REFERENCES "attendance_batches"("tenant_id", "id", "hall_sitting_id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_tenant_id_seat_assignment_id_fkey" FOREIGN KEY ("tenant_id", "seat_assignment_id") REFERENCES "seat_assignments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "attendance_tenant_id_updated_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "updated_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "incidents_tenant_id_hall_sitting_id_fkey" FOREIGN KEY ("tenant_id", "hall_sitting_id") REFERENCES "hall_sittings"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "incidents_tenant_id_created_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "created_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "incidents_tenant_id_disposed_by_membership_id_fkey" FOREIGN KEY ("tenant_id", "disposed_by_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "incident_students"
  ADD CONSTRAINT "incident_students_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "incident_students_tenant_id_incident_id_fkey" FOREIGN KEY ("tenant_id", "incident_id") REFERENCES "incidents"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "incident_students_tenant_id_registration_subject_id_fkey" FOREIGN KEY ("tenant_id", "registration_subject_id") REFERENCES "registration_subjects"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "duties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "duties" FORCE ROW LEVEL SECURITY;
CREATE POLICY "duties_tenant_isolation" ON "duties" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "attendance_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_batches" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_batches_tenant_isolation" ON "attendance_batches" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_tenant_isolation" ON "attendance" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "incidents_tenant_isolation" ON "incidents" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE "incident_students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident_students" FORCE ROW LEVEL SECURITY;
CREATE POLICY "incident_students_tenant_isolation" ON "incident_students" USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exam_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "duties", "attendance_batches", "attendance", "incidents", "incident_students" TO exam_app;
  END IF;
END
$$;
