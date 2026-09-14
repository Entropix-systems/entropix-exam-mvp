-- Platform-admin institution management without synthetic tenant memberships.

ALTER TABLE "tenants"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'COLLEGE',
  ADD COLUMN "primary_administrator_name" TEXT NOT NULL DEFAULT 'Not provisioned',
  ADD COLUMN "primary_administrator_email" TEXT NOT NULL DEFAULT 'not-provisioned@example.invalid',
  ADD COLUMN "onboarding_state" TEXT NOT NULL DEFAULT 'COMPLETE';

UPDATE "tenants"
SET "code" = upper(replace("slug", '-', '_'))
WHERE "code" IS NULL;

ALTER TABLE "tenants"
  ALTER COLUMN "code" SET NOT NULL,
  ADD CONSTRAINT "tenants_code_key" UNIQUE ("code"),
  ADD CONSTRAINT "tenants_type_check" CHECK ("type" = btrim("type") AND length("type") BETWEEN 1 AND 80),
  ADD CONSTRAINT "tenants_onboarding_state_check" CHECK ("onboarding_state" IN ('COMPLETE', 'PENDING'));

ALTER TABLE "sessions" DROP CONSTRAINT "sessions_context_binding_check";
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_context_binding_check"
  CHECK (
    ("kind" = 'PLATFORM' AND "membership_id" IS NULL)
    OR
    ("kind" = 'TENANT' AND "tenant_id" IS NOT NULL AND "membership_id" IS NOT NULL)
  );

CREATE TABLE "platform_audit_events" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "tenant_id" UUID,
  "action" TEXT NOT NULL,
  "previous" JSONB,
  "next" JSONB,
  "request_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_audit_events_request_id_key" UNIQUE ("request_id"),
  CONSTRAINT "platform_audit_events_action_check" CHECK ("action" = btrim("action") AND length("action") BETWEEN 1 AND 100),
  CONSTRAINT "platform_audit_events_request_id_check" CHECK ("request_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$')
);
CREATE INDEX "platform_audit_events_actor_user_id_created_at_idx" ON "platform_audit_events"("actor_user_id", "created_at");
CREATE INDEX "platform_audit_events_tenant_id_created_at_idx" ON "platform_audit_events"("tenant_id", "created_at");
ALTER TABLE "platform_audit_events"
  ADD CONSTRAINT "platform_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "platform_audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_platform_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'platform audit events are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "platform_audit_events_immutable" BEFORE UPDATE OR DELETE ON "platform_audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_platform_audit_event_mutation();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exam_app') THEN
    GRANT SELECT, INSERT ON "platform_audit_events" TO exam_app;
  END IF;
END
$$;
