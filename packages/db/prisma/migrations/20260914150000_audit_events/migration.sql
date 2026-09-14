-- B05 Dashboard, Reports, Audit & Demo Polish: immutable tenant command audit.

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "actor_membership_id" UUID NOT NULL,
  "actor_role" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" UUID,
  "reason" TEXT,
  "request_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_actor_role_check" CHECK ("actor_role" IN ('INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY', 'INVIGILATOR', 'STUDENT', 'AUDITOR')),
  CONSTRAINT "audit_events_action_check" CHECK ("action" = btrim("action") AND length("action") BETWEEN 1 AND 100),
  CONSTRAINT "audit_events_target_type_check" CHECK ("target_type" = btrim("target_type") AND length("target_type") BETWEEN 1 AND 80),
  CONSTRAINT "audit_events_reason_check" CHECK ("reason" IS NULL OR ("reason" = btrim("reason") AND length("reason") BETWEEN 1 AND 500)),
  CONSTRAINT "audit_events_request_id_check" CHECK ("request_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$')
);

CREATE UNIQUE INDEX "audit_events_tenant_request_id_key" ON "audit_events"("tenant_id", "request_id");
CREATE INDEX "audit_events_tenant_id_created_at_idx" ON "audit_events"("tenant_id", "created_at");
CREATE INDEX "audit_events_tenant_id_actor_membership_id_created_at_idx" ON "audit_events"("tenant_id", "actor_membership_id", "created_at");

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "audit_events_tenant_id_actor_membership_id_fkey" FOREIGN KEY ("tenant_id", "actor_membership_id") REFERENCES "memberships"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_events_immutable" BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exam_app') THEN
    GRANT SELECT, INSERT ON "audit_events" TO exam_app;
  END IF;
END
$$;
