#!/usr/bin/env bash
set -euo pipefail

echo "Creating Examination ERP database roles..."

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=migration_password="$EXAM_MIGRATION_PASSWORD" \
  --set=app_password="$EXAM_APP_PASSWORD" <<'EOSQL'

CREATE ROLE exam_migration
  LOGIN
  PASSWORD :'migration_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

CREATE ROLE exam_app
  LOGIN
  PASSWORD :'app_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;
EOSQL

echo "Creating application databases..."

createdb \
  --username "$POSTGRES_USER" \
  --owner exam_migration \
  exam_mvp

createdb \
  --username "$POSTGRES_USER" \
  --owner exam_migration \
  exam_mvp_shadow

echo "Hardening public schemas..."

for db in exam_mvp exam_mvp_shadow; do
  psql \
    --username "$POSTGRES_USER" \
    --dbname "$db" \
    --set=ON_ERROR_STOP=1 <<'EOSQL'

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO exam_migration;
EOSQL
done

echo "Granting runtime privileges..."

psql \
  --username "$POSTGRES_USER" \
  --dbname exam_mvp \
  --set=ON_ERROR_STOP=1 <<'EOSQL'

GRANT CONNECT ON DATABASE exam_mvp TO exam_app;
GRANT USAGE ON SCHEMA public TO exam_app;

ALTER DEFAULT PRIVILEGES
  FOR ROLE exam_migration
  IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO exam_app;

ALTER DEFAULT PRIVILEGES
  FOR ROLE exam_migration
  IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO exam_app;
EOSQL

echo "Examination ERP PostgreSQL initialization complete."
