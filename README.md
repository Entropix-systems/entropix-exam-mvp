# Entropix Systems Examination ERP MVP

Three-day MVP implementation for the Examination ERP platform.

## Status

D0 — Engineering foundation and sprint readiness.

# 1. Clone
git clone <repo-url>
cd entropix-exam-mvp

# 2. Use the pinned Node version
nvm install
nvm use

# 3. Enable pnpm through Corepack
corepack enable

# 4. Install exactly from lockfile
pnpm install --frozen-lockfile

# 5. Start local infra
pnpm infra:up

# 6. Generate Prisma client / apply migrations
# use the repo's existing DB scripts if already defined
pnpm --filter @entropix/db exec prisma generate
pnpm --filter @entropix/db exec prisma migrate deploy
pnpm seed:academics

# 7. Verify everything
pnpm d0:verify

# 8. Start development
pnpm dev
