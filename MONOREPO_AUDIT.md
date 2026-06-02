# Monorepo Build Config Audit & Fixes

## Issues Found & Resolved

### 1. **Turbo Task Dependencies - FIXED**
**Problem:** Tasks had unnecessary `dependsOn: ["^build"]` causing cascading rebuilds even for lint/typecheck.
- `lint`, `typecheck`, `test*` don't need build artifacts
- Only `build` depends on `^build` (dependencies)

**Solution:** Removed unnecessary dependencies from lint, typecheck, test tasks. These now run independently.

### 2. **Caching Not Configured - FIXED**
**Problem:** No explicit `cache: true` in turbo.json tasks.
- Turbo caches by default, but explicit config improves transparency

**Solution:** Added `cache: true` for all deterministic tasks (build, lint, typecheck, test, proto:generate)

### 3. **E2E Tests in CI - OPTIMIZED**
**Problem:** E2E tests were cached but should not be in CI (flaky, environment-dependent)

**Solution:** Set `cache: false, persistent: true` for `test:e2e`

### 4. **DB Tasks - OPTIMIZED**
**Problem:** Database tasks had no configuration, unclear if they should be cached

**Solution:**
- `db:generate`, `db:migrate`, `db:seed`: `cache: false` (state-changing)
- `db:seed` depends on `db:migrate` (correct ordering)

### 5. **Environment Variables - ADDED**
**Problem:** Database URL and other env vars weren't declared

**Solution:** Added `globalEnv` and `globalPassThroughEnv` in turbo.json

### 6. **Proto Generation - OPTIMIZED**
**Problem:** Proto task had no dependencies defined

**Solution:** Proto generation is independent; set `cache: true` for reproducibility

## Before vs After

### Before (turbo.json)
```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [...] },
    "lint": { "dependsOn": ["^build"] },  // ❌ Unnecessary
    "typecheck": { "dependsOn": ["^build"] },  // ❌ Unnecessary
    "test": { "dependsOn": ["^build"], ... },  // ❌ Unnecessary
    "test:e2e": { "dependsOn": ["build"] }  // ❌ Not cacheable
  }
}
```

### After (turbo.json)
```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "cache": true },
    "lint": { "dependsOn": [], "cache": true },  // ✅ Independent
    "typecheck": { "dependsOn": [], "cache": true },  // ✅ Independent
    "test:unit": { "dependsOn": [], "cache": true },  // ✅ Independent
    "test:e2e": { "cache": false, "persistent": true },  // ✅ Not cached in CI
    "db:seed": { "dependsOn": ["db:migrate"], "cache": false }  // ✅ Correct ordering
  },
  "globalEnv": ["NODE_ENV"],
  "globalPassThroughEnv": ["DATABASE_URL"]
}
```

## Impact

✅ **Faster CI:** Lint/typecheck no longer trigger rebuilds
✅ **Smart Builds:** Only changed packages + dependents rebuild
✅ **Better Caching:** Explicit cache configuration
✅ **Correct Ordering:** DB tasks execute in proper sequence
✅ **Reliable Tests:** E2E tests run fresh each time in CI

## CI Pipeline Flow (Fail Fast)

1. **Install** (pnpm frozen-lockfile)
2. **Type Check** (only changed packages) ← Fail here
3. **Lint** (only changed packages) ← Fail here
4. **Build** (changed packages + dependents)
5. **Unit Tests** (only changed packages)
6. **E2E Tests** (only changed client apps)

Each step independent; failures caught early.
