# Chirp Development Setup

## Prerequisites
- Node.js 20+ | macOS/Linux/Windows
- pnpm 9+ | `npm install -g pnpm`

## Quick Start (5 min)

```bash
# 1. Install dependencies
pnpm install

# 2. Generate protocol buffers & database
pnpm run proto:generate
pnpm run db:generate
pnpm run db:migrate
pnpm run db:seed

# 3. Start dev servers (all 3 services: API, User App, Admin App)
pnpm run dev
```

**Services:**
- User App: http://localhost:3000
- Admin App: http://localhost:3002
- API: http://localhost:3001

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| alice@test.com | password123 | User |
| bob@test.com | password123 | User |
| admin@chirp.com | admin123 | Admin |

## Common Commands

```bash
pnpm run build          # Build all packages (smart rebuild)
pnpm run typecheck      # Type check all packages
pnpm run lint           # Lint all packages
pnpm run lint:fix       # Auto-fix linting issues

pnpm run test:unit      # Run unit tests
pnpm run test:e2e       # Run E2E tests (client-only)

pnpm run dev:user       # Start only user app
pnpm run dev:admin      # Start only admin app
pnpm run dev:api        # Start only API server

pnpm run clean          # Clean all build artifacts
```

## Pre-commit Checks

Staged changes are automatically validated:
- TypeScript type checking
- Biome linting & formatting
- Commit blocked if checks fail

## Monorepo Structure

```
apps/
  api/                  # gRPC backend
  client-user/          # User-facing app
  client-admin/         # Admin dashboard

packages/
  db-schema/            # Drizzle ORM schema
  proto/                # gRPC definitions
  grpc-client/          # gRPC client lib
  ui/                   # Shared UI components
  shared-types/         # Shared types
```

## Troubleshooting

**Port conflicts?**
```bash
kill -9 $(lsof -ti:3000,3001,3002)
```

**Fresh start?**
```bash
pnpm run clean
rm -f chirp.db* && pnpm install
pnpm run proto:generate && pnpm run db:migrate && pnpm run db:seed
```

**Need help?** See TASK.md, SECURITY.md, OBSERVABILITY.md, PERFORMANCE.md
