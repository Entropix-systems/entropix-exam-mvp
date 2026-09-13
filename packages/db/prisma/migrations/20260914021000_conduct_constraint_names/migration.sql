-- Align the compact A05 attendance foreign-key name with Prisma's canonical name.
ALTER TABLE "attendance"
  RENAME CONSTRAINT "attendance_tenant_id_batch_id_sitting_id_fkey"
  TO "attendance_tenant_id_attendance_batch_id_hall_sitting_id_fkey";
