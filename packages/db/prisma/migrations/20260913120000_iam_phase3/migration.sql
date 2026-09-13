-- IAM Phase 3: persistent credentials, membership lifecycle and rotating sessions.

DROP INDEX "role_grants_tenant_membership_role_key";

ALTER TABLE "users"
  ADD COLUMN "platform_role" TEXT;

ALTER TABLE "memberships"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "role_grants"
  ADD COLUMN "department_id" UUID;

CREATE TABLE "sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "tenant_id" UUID,
  "membership_id" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "last_used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "revocation_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_tokens" (
  "id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "session_id" UUID,
  "tenant_id" UUID,
  "membership_id" UUID,
  "predecessor_id" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users"
  ADD CONSTRAINT "users_email_canonical_check"
  CHECK ("email" = lower(btrim("email")) AND length("email") BETWEEN 3 AND 320),
  ADD CONSTRAINT "users_status_check"
  CHECK ("status" IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  ADD CONSTRAINT "users_platform_role_check"
  CHECK ("platform_role" IS NULL OR "platform_role" = 'PLATFORM_ADMIN');

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_slug_canonical_check"
  CHECK ("slug" = lower(btrim("slug")));

ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_status_check"
  CHECK ("status" IN ('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED')),
  ADD CONSTRAINT "memberships_version_check"
  CHECK ("version" > 0);

ALTER TABLE "role_grants"
  ADD CONSTRAINT "role_grants_role_check"
  CHECK ("role" IN (
    'INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY',
    'INVIGILATOR', 'STUDENT', 'AUDITOR'
  )),
  ADD CONSTRAINT "role_grants_department_scope_check"
  CHECK (
    ("role" = 'DEPARTMENT_ADMIN' AND "department_id" IS NOT NULL)
    OR ("role" = 'INSTITUTION_ADMIN' AND "department_id" IS NULL)
    OR "role" NOT IN ('DEPARTMENT_ADMIN', 'INSTITUTION_ADMIN')
  );

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_kind_check"
  CHECK ("kind" IN ('PLATFORM', 'TENANT')),
  ADD CONSTRAINT "sessions_context_binding_check"
  CHECK (
    ("kind" = 'PLATFORM' AND "tenant_id" IS NULL AND "membership_id" IS NULL)
    OR
    ("kind" = 'TENANT' AND "tenant_id" IS NOT NULL AND "membership_id" IS NOT NULL)
  ),
  ADD CONSTRAINT "sessions_expiry_check"
  CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "sessions_revocation_check"
  CHECK (
    ("revoked_at" IS NULL AND "revocation_reason" IS NULL)
    OR
    ("revoked_at" IS NOT NULL AND length(btrim("revocation_reason")) > 0)
  );

ALTER TABLE "auth_tokens"
  ADD CONSTRAINT "auth_tokens_hash_check"
  CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "auth_tokens_purpose_check"
  CHECK ("purpose" IN ('INVITATION', 'PASSWORD_RESET', 'REFRESH')),
  ADD CONSTRAINT "auth_tokens_expiry_check"
  CHECK ("expires_at" > "created_at"),
  ADD CONSTRAINT "auth_tokens_binding_check"
  CHECK (
    ("purpose" = 'REFRESH' AND "session_id" IS NOT NULL)
    OR
    ("purpose" = 'INVITATION' AND "session_id" IS NULL AND "tenant_id" IS NOT NULL AND "membership_id" IS NOT NULL)
    OR
    ("purpose" = 'PASSWORD_RESET' AND "session_id" IS NULL AND "tenant_id" IS NULL AND "membership_id" IS NULL)
  ),
  ADD CONSTRAINT "auth_tokens_predecessor_check"
  CHECK ("predecessor_id" IS NULL OR "purpose" = 'REFRESH');

CREATE UNIQUE INDEX "memberships_tenant_id_user_id_key"
  ON "memberships"("tenant_id", "id", "user_id");

CREATE UNIQUE INDEX "role_grants_scope_key"
  ON "role_grants"("tenant_id", "membership_id", "role", "department_id") NULLS NOT DISTINCT;
CREATE INDEX "role_grants_scope_idx"
  ON "role_grants"("tenant_id", "membership_id", "role", "department_id");

CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "sessions_tenant_id_membership_id_idx" ON "sessions"("tenant_id", "membership_id");
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");
CREATE UNIQUE INDEX "auth_tokens_predecessor_id_key" ON "auth_tokens"("predecessor_id");
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");
CREATE INDEX "auth_tokens_session_id_idx" ON "auth_tokens"("session_id");
CREATE INDEX "auth_tokens_tenant_id_membership_id_idx" ON "auth_tokens"("tenant_id", "membership_id");
CREATE INDEX "auth_tokens_purpose_expires_at_idx" ON "auth_tokens"("purpose", "expires_at");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "sessions_tenant_id_membership_id_user_id_fkey"
  FOREIGN KEY ("tenant_id", "membership_id", "user_id")
  REFERENCES "memberships"("tenant_id", "id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auth_tokens"
  ADD CONSTRAINT "auth_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "auth_tokens_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "auth_tokens_tenant_id_membership_id_user_id_fkey"
  FOREIGN KEY ("tenant_id", "membership_id", "user_id")
  REFERENCES "memberships"("tenant_id", "id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "auth_tokens_predecessor_id_fkey"
  FOREIGN KEY ("predecessor_id") REFERENCES "auth_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

