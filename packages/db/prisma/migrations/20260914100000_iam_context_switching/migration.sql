-- Persist the effective role selected for a session and allow identity routing
-- queries to discover only the authenticated user's own institution access.

BEGIN;

ALTER TABLE "sessions"
  ADD COLUMN "active_role" TEXT;

-- Migration owner needs a complete one-time backfill view. Prisma applies this
-- migration transactionally and FORCE RLS is restored before commit.
ALTER TABLE "role_grants" NO FORCE ROW LEVEL SECURITY;

UPDATE "sessions" AS session
SET "active_role" = COALESCE(
  (
    SELECT role_grant."role"
    FROM "role_grants" AS role_grant
    WHERE role_grant."tenant_id" = session."tenant_id"
      AND role_grant."membership_id" = session."membership_id"
    ORDER BY
      CASE role_grant."role"
        WHEN 'INSTITUTION_ADMIN' THEN 1
        WHEN 'EXAM_CONTROLLER' THEN 2
        WHEN 'DEPARTMENT_ADMIN' THEN 3
        WHEN 'FACULTY' THEN 4
        WHEN 'INVIGILATOR' THEN 5
        WHEN 'STUDENT' THEN 6
        WHEN 'AUDITOR' THEN 7
        ELSE 99
      END,
      role_grant."id"
    LIMIT 1
  ),
  'STUDENT'
)
WHERE session."kind" = 'TENANT';

UPDATE "sessions" AS session
SET "revoked_at" = CURRENT_TIMESTAMP,
    "revocation_reason" = 'AUTHORITY_CHANGED'
WHERE session."kind" = 'TENANT'
  AND session."revoked_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "role_grants" AS role_grant
    WHERE role_grant."tenant_id" = session."tenant_id"
      AND role_grant."membership_id" = session."membership_id"
      AND role_grant."role" = session."active_role"
  );

ALTER TABLE "role_grants" FORCE ROW LEVEL SECURITY;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_active_role_check"
  CHECK (
    ("kind" = 'PLATFORM' AND "active_role" IS NULL)
    OR
    ("kind" = 'TENANT' AND "active_role" IN (
      'INSTITUTION_ADMIN', 'EXAM_CONTROLLER', 'DEPARTMENT_ADMIN', 'FACULTY',
      'INVIGILATOR', 'STUDENT', 'AUDITOR'
    ))
  );

-- This transaction-local identity context is set only after credentials or an
-- existing access token have been verified. It permits one bounded routing
-- query without weakening the normal tenant policy used by business data.
CREATE POLICY "memberships_identity_user_access"
ON "memberships"
FOR SELECT
USING (
  "user_id" =
  NULLIF(current_setting('app.identity_user_id', true), '')::uuid
);

CREATE POLICY "role_grants_identity_user_access"
ON "role_grants"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM "memberships" AS membership
    WHERE membership."tenant_id" = "role_grants"."tenant_id"
      AND membership."id" = "role_grants"."membership_id"
      AND membership."user_id" =
        NULLIF(current_setting('app.identity_user_id', true), '')::uuid
  )
);

COMMIT;
