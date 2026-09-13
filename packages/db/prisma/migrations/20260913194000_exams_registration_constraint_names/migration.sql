-- Keep applied A03 foreign-key names aligned with Prisma's canonical schema names.
ALTER TABLE "registration_subjects"
  RENAME CONSTRAINT "registration_subjects_tenant_enrolment_fkey"
  TO "registration_subjects_tenant_id_enrolment_id_fkey";
ALTER TABLE "registration_subjects"
  RENAME CONSTRAINT "registration_subjects_tenant_exam_subject_exam_fkey"
  TO "registration_subjects_tenant_id_exam_subject_id_exam_id_fkey";
ALTER TABLE "registration_subjects"
  RENAME CONSTRAINT "registration_subjects_tenant_registration_exam_fkey"
  TO "registration_subjects_tenant_id_registration_id_exam_id_fkey";
