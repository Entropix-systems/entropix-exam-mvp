-- Keep the PostgreSQL-truncated A04 foreign-key name aligned with Prisma's canonical name.
ALTER TABLE "seat_assignments"
  RENAME CONSTRAINT "seat_assignments_tenant_id_registration_subject_id_exam_subject"
  TO "seat_assignments_tenant_id_registration_subject_id_exam_su_fkey";
