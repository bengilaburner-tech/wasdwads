import { describe, expect, it } from "vitest";
import {
	createTestComment,
	createTestLike,
	createTestPost,
	createTestUser,
} from "../../tests/helpers";
import { queryMetrics } from "../db";
import { getHomeFeed } from "./feed.service";
import { getBookmarkedPosts, toggleBookmark } from "./bookmarks.service";
import { getUser } from "./users.service";
import { toggleFollow } from "./follows.service";

const createPostWithActivity = async (authorId: string, likerId: string) => {
	const postId = await createTestPost(authorId, "Perf test post");
	await createTestLike(likerId, postId);
	await createTestComment(postId, authorId, "Perf test comment");
	return postId;
};

describe("PerformanceService", () => {
	describe("getHomeFeed", () => {
		it("loads 10 feed posts with a fixed small number of SQL queries", async () => {
			const user = await createTestUser();
			const followed = await createTestUser();

			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);
			await createPostWithActivity(followed.id, user.id);

			await toggleFollow(followed.username, user.id);
			queryMetrics.count = 0;

			const feed = await getHomeFeed(user.id, { limit: 10 });
			expect(feed).toHaveLength(10);
			expect(feed[0].likeCount).toBeGreaterThanOrEqual(0);
			expect(feed[0].commentCount).toBeGreaterThanOrEqual(0);
			expect(feed[0].isLiked).toBeDefined();
			expect(queryMetrics.count).toBe(5);
		});
	});

	describe("getBookmarkedPosts", () => {
		it("loads 10 bookmarks with a fixed small number of SQL queries", async () => {
			const user = await createTestUser();
			const author = await createTestUser();

			const postIds = await Promise.all(
				Array.from({ length: 10 }, () => createPostWithActivity(author.id, user.id)),
			);

			for (const postId of postIds) {
				await toggleBookmark(postId, user.id);
			}

			queryMetrics.count = 0;
			const bookmarks = await getBookmarkedPosts(user.id, user.id, 10, 0);

			expect(bookmarks).toHaveLength(10);
			expect(bookmarks[0].bookmarkedAt).toBeDefined();
			expect(bookmarks[0].likeCount).toBeGreaterThanOrEqual(0);
			expect(bookmarks[0].commentCount).toBeGreaterThanOrEqual(0);
			expect(bookmarks[0].isLiked).toBe(true);
			expect(queryMetrics.count).toBe(5);
		});
	});

	describe("getUser", () => {
		it("loads profile counts in one additional query instead of many", async () => {
			const user = await createTestUser();
			const follower = await createTestUser();

			await toggleFollow(user.username, follower.id);
			await createTestPost(user.id, "Profile post 1");
			await createTestPost(user.id, "Profile post 2");

			queryMetrics.count = 0;
			const profile = await getUser(user.username, follower.id);

			expect(profile.postCount).toBe(2);
			expect(profile.followerCount).toBe(1);
			expect(profile.followingCount).toBe(0);
			expect(profile.isFollowing).toBe(true);
			expect(queryMetrics.count).toBe(2);
		});
	});
});
