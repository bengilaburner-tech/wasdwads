# Query Performance Findings

This repository had a severe query-count anti-pattern in the feed, bookmarks, and profile APIs.

## What was wrong

- `getHomeFeed()` loaded home feed posts in one query, then called `getPostCounts()` for every post.
- `getPostCounts()` performed 3 separate queries per post: likes count, comment count, and conditional like-status.
- `getBookmarkedPosts()` fetched bookmarked post IDs, then used `Promise.all()` to load each bookmarked post and its counts one-by-one.
- `getUser()` loaded profile metadata with separate count queries for followers, following, posts, and follow status.

This produced an N+1 query pattern for feeds and bookmarks.

## Exact query counts for 10 items

| Page | Before | After |
|---|---|---|
| Home feed (10 posts) | 32 queries | 5 queries |
| Bookmarks page (10 bookmarked posts) | 41 queries | 5 queries |
| User profile page | 5 queries | 2 queries |

### How those counts break down

- Home feed before: 1 query for followings + 1 for posts + 10 * 3 count queries = 32
- Home feed after: 1 followings + 1 posts + 1 likes group + 1 comments group + 1 liked-status group = 5
- Bookmarks before: 1 bookmarked-post IDs + 10 * (1 post + 1 likes + 1 comments + 1 like status) = 41
- Bookmarks after: 1 bookmarked-post IDs + 1 batched posts + 1 likes group + 1 comments group + 1 liked-status group = 5
- Profile before: 1 user + 1 follower count + 1 following count + 1 post count + 1 follow-status = 5
- Profile after: 1 user + 1 aggregated profile counts query = 2

## Fixes implemented

- Added `apps/api/src/services/query-utils.ts` to centralize batched queries.
- Replaced per-post count loops in `apps/api/src/services/feed.service.ts` and `apps/api/src/services/bookmarks.service.ts`.
- Added `loadPostAggregates()` and `loadPostsWithAuthors()` to keep response shapes unchanged while batching database work.
- Reworked `apps/api/src/services/users.service.ts` to load user profile counts with one aggregated query.
- Added regression coverage in `apps/api/src/services/performance.service.test.ts`.
- Added query counting instrumentation in `apps/api/src/db/index.ts` and `apps/api/tests/setup.ts`.

## Reusable pattern

- Batch lookups by key list instead of querying per item.
- Group counts by `postId` and map them back to the post objects.
- Keep metadata joins separate from the main result query, but execute them in constant-time grouped queries.
- Use helper functions such as `loadPostAggregates()` and `loadUserProfileCounts()` to make one-off queries easier to audit.

## Notes

- API response shapes are preserved; the only change is internal query execution.
- The new helper file can be reused for future post-related list views and profile count queries.
