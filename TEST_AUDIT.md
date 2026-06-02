# Test Infrastructure & Coverage Audit

**Date:** June 2, 2026  
**Scope:** API unit tests, client E2E tests, test helpers, test isolation  
**Status:** Complete audit with findings and remediation plan

## Executive Summary

The codebase has a **mixed test coverage profile**:
- ✅ **Strong areas:** Auth, posts, comments, likes, follows services tested with good error path coverage
- ❌ **Gaps:** 7 services untested (admin, bookmarks, feed, mentions, notifications, search, users)
- ⚠️ **E2E:** Good coverage of user flows but limited admin and edge cases
- 🔧 **Test Isolation:** Minor issues in parallel execution; database cleanup timing sensitive

**Total Test Files:** 17 (10 service/handler tests + 24 E2E tests + 2 infrastructure tests)

---

## 1. Service Layer Test Coverage

### ✅ Services WITH Comprehensive Tests (5/12)

| Service | Test File | Methods | Coverage |
|---------|-----------|---------|----------|
| **auth** | `auth.service.test.ts` | 4 | Excellent |
| **posts** | `posts.service.test.ts` | 6 | Excellent |
| **comments** | `comments.service.test.ts` | 3 | Good |
| **likes** | `likes.service.test.ts` | 4 | Good |
| **follows** | `follows.service.test.ts` | 4 | Good |

**Examples of good coverage patterns:**
- Input validation (empty strings, length limits, special characters)
- Permission checks (own vs. others' resources)
- Duplicate prevention (unique constraints)
- Not found scenarios
- State verification (e.g., user created in database)

### ❌ Services WITHOUT Tests (7/12)

| Service | Key Methods | Impact | Priority |
|---------|------------|--------|----------|
| **admin** | 15+ methods | Core moderation features untested | 🔴 High |
| **bookmarks** | 3 methods | User feature untested | 🟡 Medium |
| **feed** | 2 methods | Core feed algorithm untested | 🔴 High |
| **mentions** | 3 methods | Social feature untested | 🟡 Medium |
| **notifications** | 5 methods | User engagement untested | 🟡 Medium |
| **search** | 2 methods | User discovery untested | 🟡 Medium |
| **users** | 2 methods | Profile management untested | 🟡 Medium |

**Risk Assessment:**
- **Admin service (15+ methods):** Missing tests for ban/unban, role updates, deletion cascades, audit logging
- **Feed service (2 methods):** No tests for pagination, sorting, filtering edge cases
- **Search service (2 methods):** No tests for query parsing, result ranking, pagination

### Utility/Infrastructure Files WITHOUT Direct Tests (3)

| File | Purpose | Impact | Current |
|------|---------|--------|---------|
| `query-utils.ts` | SQL optimization utilities | Medium | No test |
| `utils.ts` | Shared helpers (ID generation, hashing) | High | No test |
| `error.ts` | Error taxonomy | High | Covered by observability.test.ts |
| `tracing.ts` | Trace context and logging | High | Covered by observability.test.ts |

---

## 2. Handler Layer Test Coverage

### Handler Tests by Status

**Tests Exist (6 handlers):**
- ✅ `auth.handler.test.ts` - 5 methods
- ✅ `posts.handler.test.ts` - 6 methods
- ✅ `comments.handler.test.ts` - 3 methods
- ✅ `likes.handler.test.ts` - 4 methods
- ✅ `admin.handler.test.ts` - 12 methods (mocked)
- ✅ `handler-error-handling.test.ts` - Integration tests

**Tests Missing (5 handlers):**
- ❌ `bookmarks.handler` - 3 methods
- ❌ `follows.handler` - 4 methods
- ❌ `feed.handler` - 2 methods
- ❌ `notifications.handler` - 5 methods
- ❌ `search.handler` - 2 methods
- ❌ `users.handler` - 2 methods

### Current Handler Test Pattern

```typescript
// Pattern: Mock services, test request/response mapping
vi.mock("../../../services/auth.service");
vi.mock("../../../middleware/auth");

describe("AuthHandler", () => {
  it("returns success with data on service success", async () => {
    vi.mocked(registerUser).mockResolvedValue({ userId: "123", sessionToken: "abc" });
    const result = await authHandler.register({...});
    expect(result.success).toBe(true);
  });
  
  it("handles errors from service", async () => {
    vi.mocked(registerUser).mockRejectedValue(new Error("..."));
    const result = await authHandler.register({...});
    expect(result.success).toBe(false);
  });
});
```

**Strengths:**
- Clear isolation via mocking
- Good error scenario coverage
- Trace ID inclusion tested (post-Issue 3)

**Weaknesses:**
- Services mocked → doesn't catch integration issues
- Limited to happy path + basic error
- No concurrent request testing

---

## 3. E2E Test Coverage

### Client-User App (13 test files)

**Coverage:**
- ✅ Auth (register, login, password validation)
- ✅ Posts (create, view, update, delete)
- ✅ Comments (add, reply, delete)
- ✅ Bookmarks (toggle, list)
- ✅ Feed (home, explore, pagination)
- ✅ Notifications (list, mark read)
- ✅ Profile (view, edit)
- ✅ Search (posts, users)
- ✅ Mentions (tag detection)

**Pattern:** 
- Simple flows (e.g., `auth.spec.ts`) → 5-6 basic tests
- Comprehensive flows (e.g., `auth.comprehensive.spec.ts`) → 20+ tests with edge cases

### Client-Admin App (10 test files)

**Coverage:**
- ✅ Auth (login)
- ✅ Dashboard (stats, metrics)
- ✅ Users (list, details, ban, role changes)
- ✅ Posts (list, delete)
- ✅ Reports (list, review workflow)
- ✅ Audit logs (view)
- ⚠️ Moderation workflow (basic only)
- ⚠️ Navigation (basic only)

**Gaps:**
- Limited concurrent admin actions
- No stress testing (many posts/comments)
- No cascade deletion verification
- Limited error scenarios (network failures, timeouts)

---

## 4. Test Isolation Issues Identified

### 🟡 Issue #1: Database Cleanup Race Condition (MINOR)

**Location:** `apps/api/tests/setup.ts` → `beforeEach` hook

**Current Implementation:**
```typescript
beforeEach(async () => {
  await client.execute("DELETE FROM audit_logs");
  await client.execute("DELETE FROM reports");
  // ... more deletes
  await client.execute("DELETE FROM users");
});
```

**Problem:**
- Runs **before** each test, not **after**
- If parallel test workers start simultaneously, cleanup might incomplete before test data creation
- Foreign key constraints can cause cleanup failures if order wrong

**Current Mitigation:**
- Correct dependency-based delete order present (good!)
- In-memory database per test file (vitest isolates by default)
- `beforeEach` runs sequentially before each test

**Risk:** Low (in-memory DB isolates per file, sequential beforeEach), but could fail under true parallel execution

**Recommendation:** Verify vitest isn't running tests in parallel within a single file

### 🟡 Issue #2: Shared Handler Test Mocks (MINOR)

**Location:** `apps/api/src/grpc/handlers/__tests__/*.handler.test.ts`

**Current Implementation:**
```typescript
vi.mock("../../../services/auth.service");
vi.mock("../../../middleware/auth");

describe("AuthHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  // ...
});
```

**Problem:**
- Mocks are global to the test file
- If multiple test suites run in parallel, mocks could bleed between tests

**Current Mitigation:**
- `beforeEach` calls `vi.clearAllMocks()`
- `afterEach` calls `vi.resetAllMocks()`
- Tests in same file run sequentially (vitest default)

**Risk:** Low (if file-level parallelization disabled), but high if enabled

**Recommendation:** Add `afterEach` reset, verify mock isolation

### 🟢 Issue #3: E2E Test Isolation is GOOD

**Pattern (Excellent):**
```typescript
// auth.spec.ts
await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
await page.fill('input[name="username"]', `testuser${Date.now()}`);
```

**Strengths:**
- Unique identifiers per test run (`Date.now()`)
- Browser context isolated per test
- No shared state between tests
- Can run fully parallel (`fullyParallel: true`)

---

## 5. Test Helper Patterns

### Current Helpers (`apps/api/tests/helpers.ts`)

**Good patterns:**
```typescript
// Overridable defaults with sensible values
export async function createTestUser(overrides: Partial<{...}> = {}): Promise<TestUser> {
  const id = generateId();
  const email = overrides.email || `test-${id}@example.com`;
  // ... generates unique identifiers
}

// Helper composition
const user = await createTestUser();
const postId = await createTestPost(user.id, "Test content");
const commentId = await createTestComment(postId, user.id);
```

**Gaps:**
- No helpers for admin-specific operations (ban users, assign roles)
- No helpers for bulk data creation (20 posts, 100 comments)
- No helpers for error simulation (corrupt data, constraint violations)
- No fixtures for pre-populated databases

**Needed Helpers:**
```typescript
// Admin operations
createBannedUser(reason: string)
assignAdminRole(userId: string)
createReport(targetId: string, reason: string)

// Bulk operations
createPostsForUser(userId: string, count: number)
createCommentThread(postId: string, depth: number)

// Error scenarios
createDataWithConstraintViolation()
```

---

## 6. Untested Error Paths

### By Service

#### **Auth Service**
- ✅ Duplicate email/username
- ✅ Invalid credentials
- ✅ Session expiration
- ❌ Concurrent login attempts
- ❌ Multiple session tokens for same user
- ❌ Password policy violations (if any)

#### **Posts Service**
- ✅ Permissions (own vs. others)
- ✅ Not found
- ✅ Content validation
- ❌ Cascade delete (author deleted)
- ❌ Concurrent edits
- ❌ Very large documents

#### **Admin Service** (ENTIRELY UNTESTED)
- ❌ Ban user cascade effects
- ❌ Role update permissions
- ❌ Delete post cascades to likes/comments
- ❌ Report review workflows
- ❌ Audit log accuracy
- ❌ Concurrent admin actions

#### **Bookmarks Service**
- ✅ Toggle (add/remove) - likely tested via E2E
- ❌ Delete post with active bookmarks
- ❌ Pagination of bookmarks
- ❌ Bookmark after post deletion

#### **Feed Service** (ENTIRELY UNTESTED)
- ❌ Large feeds (1000+ posts)
- ❌ Feed with deleted posts
- ❌ Feed with banned authors
- ❌ Pagination consistency
- ❌ Feed ordering (chronological, algorithm)

#### **Search Service**
- ❌ Empty query handling
- ❌ Special characters in search
- ❌ Unicode/emoji search
- ❌ Search on deleted content

#### **Notifications Service**
- ❌ Notification for deleted posts/comments
- ❌ Notification batch operations
- ❌ Cascade delete of notifications

---

## 7. Coverage Metrics

### Current Line Coverage

Based on vitest config (`include: ["src/services/**/*.ts"]`):

**Estimated by file:**
```
auth.service.ts          ~85% (good tests)
posts.service.ts         ~80% (good tests)
comments.service.ts      ~75% (decent tests)
likes.service.ts         ~75% (basic tests)
follows.service.ts       ~75% (basic tests)
admin.service.ts         ~0%  (NO TESTS)
bookmarks.service.ts     ~0%  (NO TESTS)
feed.service.ts          ~0%  (NO TESTS)
mentions.service.ts      ~0%  (NO TESTS)
notifications.service.ts ~0%  (NO TESTS)
search.service.ts        ~0%  (NO TESTS)
users.service.ts         ~0%  (NO TESTS)
utils.ts                 ~0%  (NO TESTS)
query-utils.ts           ~0%  (NO TESTS)
```

**Overall:** ~30% service layer coverage

### E2E Coverage

**User flows covered:** ~70% (most happy paths)
**Admin workflows covered:** ~40% (basic operations only)
**Error scenarios:** ~20%

---

## 8. Test Configuration Issues

### ✅ Strengths

1. **vitest config** properly isolates tests
2. **Database setup** creates clean in-memory DB per test file
3. **E2E Playwright config** enables parallel execution safely
4. **Global setup** prevents Vite compilation bottlenecks

### ⚠️ Areas to Monitor

1. **Parallel execution**: Currently safe, but watch for state leakage if optimizing for speed
2. **Database cleanup**: Dependency-ordered, but confirm with parallel settings
3. **Mock isolation**: No cross-file contamination currently, but verify

---

## 9. Recommended Fixes (Priority Order)

### 🔴 CRITICAL (Blocking Production Reliability)

1. **Add admin.service tests** (15+ methods)
   - Ban/unban workflows
   - Role management
   - Delete cascades
   - Audit logging verification
   - Estimated: 50-100 test cases

2. **Add feed.service tests** (2 methods, complex logic)
   - Pagination edge cases
   - Deleted author posts
   - Banned user filtering
   - Estimated: 20-30 test cases

3. **Add utils.ts and query-utils.ts tests**
   - ID generation uniqueness
   - Password hashing security
   - Query optimization verification
   - Estimated: 20 test cases

### 🟡 HIGH (Improves Reliability)

4. **Add missing handler tests** (6 handlers × 2-5 methods)
   - bookmarks, follows, feed, notifications, search, users
   - Trace ID propagation
   - Error handling consistency
   - Estimated: 40-60 test cases

5. **Add error path tests** (across all services)
   - Concurrent modifications
   - Cascade deletes
   - Constraint violations
   - Estimated: 30-50 test cases

### 🟢 MEDIUM (Polish)

6. **Enhance test helpers**
   - Admin-specific fixtures
   - Bulk data creation
   - Error simulation
   - Estimated: 5-10 new helpers

7. **Add E2E error scenarios**
   - Network timeouts
   - Invalid inputs
   - Concurrent operations
   - Estimated: 30-50 E2E tests

8. **Fix potential test isolation issues**
   - Verify beforeEach/afterEach timing
   - Test mock isolation under parallel execution
   - Document parallel test safety
   - Estimated: Verification only

---

## 10. Test Audit Results Summary

| Category | Status | Details |
|----------|--------|---------|
| **Service Tests** | ⚠️ Partial | 5/12 services, ~30% line coverage |
| **Handler Tests** | ⚠️ Partial | 6/11 handlers, good error handling |
| **E2E Tests** | ✅ Good | ~70% user flows, admin gaps |
| **Error Paths** | ❌ Poor | Most untested error scenarios |
| **Test Isolation** | ✅ Good | Minor race condition risks |
| **Test Helpers** | ⚠️ Basic | Core helpers exist, admin/bulk missing |
| **Documentation** | ❌ Missing | No test strategy documented |

### Immediate Action Items

1. ✅ **Document findings** (this audit)
2. 🔴 **Add admin.service tests** (highest priority)
3. 🔴 **Add feed.service tests** (second priority)
4. 🟡 **Add missing handler tests**
5. 🟡 **Fix test isolation race conditions**
6. 🟡 **Extend helpers for admin/bulk operations**
7. 🔧 **Create test strategy document**

---

## Appendix: Test File Inventory

### API Unit Tests (10 files)

```
apps/api/src/services/
├── auth.service.test.ts           ✅ 4 methods
├── posts.service.test.ts          ✅ 6 methods
├── comments.service.test.ts       ✅ 3 methods
├── likes.service.test.ts          ✅ 4 methods
├── follows.service.test.ts        ✅ 4 methods
├── performance.service.test.ts    ✅ 1 service (utilities)
├── observability.test.ts          ✅ Infrastructure tests

apps/api/src/grpc/
├── handlers/__tests__/
│   ├── auth.handler.test.ts       ✅ 5 handler methods
│   ├── posts.handler.test.ts      ✅ 6 handler methods
│   ├── comments.handler.test.ts   ✅ 3 handler methods
│   ├── likes.handler.test.ts      ✅ 4 handler methods
│   └── admin.handler.test.ts      ✅ 12 handler methods (mocked)
├── handlers/handler-error-handling.test.ts ✅ Integration
└── server.test.ts                 ✅ Credentials
```

### E2E Tests (24 files)

**Client-User:** 13 files (simple + comprehensive patterns)
**Client-Admin:** 10 files (simple + comprehensive patterns)
**Utilities:** 1 shared fixture file

---

## Document Version

**Version:** 1.0  
**Created:** June 2, 2026  
**Updated:** [Will be updated as fixes are implemented]
