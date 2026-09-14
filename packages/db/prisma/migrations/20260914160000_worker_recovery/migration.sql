-- Release evidence closure: durable worker leasing and idempotent business output.

CREATE TABLE "worker_jobs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "business_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'READY',
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_owner" TEXT,
  "lease_expires_at" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "worker_jobs_state_check" CHECK ("state" IN ('READY', 'LEASED', 'COMPLETED')),
  CONSTRAINT "worker_jobs_kind_check" CHECK ("kind" = btrim("kind") AND length("kind") BETWEEN 1 AND 80),
  CONSTRAINT "worker_jobs_business_key_check" CHECK ("business_key" = btrim("business_key") AND length("business_key") BETWEEN 1 AND 160),
  CONSTRAINT "worker_jobs_lease_check" CHECK (
    ("state" = 'LEASED' AND "lease_owner" IS NOT NULL AND "lease_expires_at" IS NOT NULL AND "completed_at" IS NULL)
    OR ("state" = 'READY' AND "lease_owner" IS NULL AND "lease_expires_at" IS NULL AND "completed_at" IS NULL)
    OR ("state" = 'COMPLETED' AND "lease_owner" IS NULL AND "lease_expires_at" IS NULL AND "completed_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "worker_jobs_tenant_id_id_key" ON "worker_jobs"("tenant_id", "id");
CREATE UNIQUE INDEX "worker_jobs_tenant_kind_business_key_key" ON "worker_jobs"("tenant_id", "kind", "business_key");
CREATE INDEX "worker_jobs_tenant_id_state_available_at_lease_expires_at_idx" ON "worker_jobs"("tenant_id", "state", "available_at", "lease_expires_at");

CREATE TABLE "worker_outputs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "job_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "business_key" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "object_key" TEXT,
  "output" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_outputs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "worker_outputs_kind_check" CHECK ("kind" = btrim("kind") AND length("kind") BETWEEN 1 AND 80),
  CONSTRAINT "worker_outputs_business_key_check" CHECK ("business_key" = btrim("business_key") AND length("business_key") BETWEEN 1 AND 160),
  CONSTRAINT "worker_outputs_checksum_check" CHECK ("checksum" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "worker_outputs_tenant_id_id_key" ON "worker_outputs"("tenant_id", "id");
CREATE UNIQUE INDEX "worker_outputs_tenant_job_key" ON "worker_outputs"("tenant_id", "job_id");
CREATE UNIQUE INDEX "worker_outputs_tenant_kind_business_key_key" ON "worker_outputs"("tenant_id", "kind", "business_key");
CREATE INDEX "worker_outputs_tenant_id_created_at_idx" ON "worker_outputs"("tenant_id", "created_at");

ALTER TABLE "worker_jobs"
  ADD CONSTRAINT "worker_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "worker_outputs"
  ADD CONSTRAINT "worker_outputs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "worker_outputs_tenant_id_job_id_fkey" FOREIGN KEY ("tenant_id", "job_id") REFERENCES "worker_jobs"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "worker_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "worker_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "worker_jobs_tenant_isolation" ON "worker_jobs"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "worker_outputs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "worker_outputs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "worker_outputs_tenant_isolation" ON "worker_outputs"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'exam_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "worker_jobs", "worker_outputs" TO exam_app;
  END IF;
END
$$;
