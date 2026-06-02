import type { IBookmarksService } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
	getBookmarkedPosts,
	getBookmarkStatus,
	toggleBookmark,
} from "../../services/bookmarks.service";
import { toProtoTimestamp } from "../../services/utils";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode } from "../../services/error";

export const bookmarksHandler: IBookmarksService = {
	async toggleBookmark(request) {
		const traceId = generateTraceId();
		Logger.request("bookmarks.toggleBookmark", traceId, { postId: request.postId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await toggleBookmark(request.postId, auth.userId);

			Logger.response("bookmarks.toggleBookmark", traceId, Date.now(), true, {
				bookmarked: result.bookmarked,
			});

			return {
				success: true,
				bookmarked: result.bookmarked,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to toggle bookmark",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`bookmarks.toggleBookmark failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				bookmarked: false,
				error: appError.message,
				traceId,
			};
		}
	},

	async getBookmarkStatus(request) {
		const traceId = generateTraceId();
		Logger.request("bookmarks.getBookmarkStatus", traceId, { postId: request.postId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getBookmarkStatus(request.postId, auth.userId);

			Logger.response("bookmarks.getBookmarkStatus", traceId, Date.now(), true, {
				bookmarked: result.bookmarked,
			});

			return { bookmarked: result.bookmarked, traceId };
		} catch (error) {
			Logger.warn(
				`bookmarks.getBookmarkStatus failed`,
				traceId,
				{ errorMessage: error instanceof Error ? error.message : "Unknown error" },
			);
			return { bookmarked: false, traceId };
		}
	},

	async getBookmarkedPosts(request) {
		const traceId = generateTraceId();
		Logger.request("bookmarks.getBookmarkedPosts", traceId, {
			limit: request.limit,
			offset: request.offset,
		});

		try {
			const auth = validateSessionToken(request.sessionToken);
			const posts = await getBookmarkedPosts(
				auth.userId,
				auth.userId,
				request.limit || 20,
				request.offset || 0,
			);

			Logger.response("bookmarks.getBookmarkedPosts", traceId, Date.now(), true, {
				postCount: posts.length,
			});

			return {
				posts: posts.map((post) => ({
					id: post.id,
					content: post.content,
					createdAt: toProtoTimestamp(post.createdAt),
					updatedAt: toProtoTimestamp(post.updatedAt),
					author: post.author
						? {
								id: post.author.id,
								username: post.author.username,
								displayName: post.author.displayName,
								avatarUrl: post.author.avatarUrl || undefined,
							}
						: undefined,
					likeCount: post.likeCount,
					commentCount: post.commentCount,
					isLiked: post.isLiked,
				})),
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get bookmarked posts",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`bookmarks.getBookmarkedPosts failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return { posts: [], traceId };
		}
	},
};
