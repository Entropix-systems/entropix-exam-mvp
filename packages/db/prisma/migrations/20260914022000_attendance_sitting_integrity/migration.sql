-- Enforce that every attendance row references a seat from its own hall sitting.
CREATE UNIQUE INDEX "seat_assignments_tenant_id_sitting_key"
  ON "seat_assignments"("tenant_id", "id", "hall_sitting_id");
CREATE UNIQUE INDEX "attendance_tenant_seat_sitting_key"
  ON "attendance"("tenant_id", "seat_assignment_id", "hall_sitting_id");

ALTER TABLE "attendance"
  DROP CONSTRAINT "attendance_tenant_id_seat_assignment_id_fkey",
  ADD CONSTRAINT "attendance_tenant_seat_sitting_fkey"
    FOREIGN KEY ("tenant_id", "seat_assignment_id", "hall_sitting_id")
    REFERENCES "seat_assignments"("tenant_id", "id", "hall_sitting_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
