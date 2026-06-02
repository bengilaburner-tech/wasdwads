import type { ISearchService, PostResponse } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import { searchPosts, searchUsers } from "../../services/search.service";
import { toProtoTimestamp } from "../../services/utils";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode } from "../../services/error";

function toPostResponse(post: any): PostResponse {
	return {
		id: post.id,
		content: post.content,
		createdAt: toProtoTimestamp(post.createdAt),
		updatedAt: toProtoTimestamp(post.updatedAt),
		author: post.author
			? {
					id: post.author.id || "",
					username: post.author.username || "",
					displayName: post.author.displayName || "",
					avatarUrl: post.author.avatarUrl || undefined,
				}
			: { id: "", username: "", displayName: "" },
		likeCount: post.likeCount || 0,
		commentCount: post.commentCount || 0,
		isLiked: post.isLiked || false,
	};
}

export const searchHandler: ISearchService = {
	async searchPosts(request) {
		const traceId = generateTraceId();
		Logger.request("search.searchPosts", traceId, { query: request.query });

		try {
			let userId: string | undefined;
			if (request.sessionToken) {
				try {
					const auth = validateSessionToken(request.sessionToken);
					userId = auth.userId;
				} catch {
					// Ignore invalid token for public access
					Logger.debug("Invalid session token for searchPosts", traceId);
				}
			}

			const posts = await searchPosts(request.query, userId);

			Logger.response("search.searchPosts", traceId, Date.now(), true, {
				postCount: posts.length,
				query: request.query,
			});

			return {
				posts: posts.map(toPostResponse),
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to search posts",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`search.searchPosts failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return { posts: [], traceId };
		}
	},

	async searchUsers(request) {
		const traceId = generateTraceId();
		Logger.request("search.searchUsers", traceId, { query: request.query });

		try {
			const users = await searchUsers(request.query);

			Logger.response("search.searchUsers", traceId, Date.now(), true, {
				userCount: users.length,
				query: request.query,
			});

			return {
				users: users.map((user) => ({
					id: user.id,
					username: user.username,
					displayName: user.displayName,
					avatarUrl: user.avatarUrl || undefined,
					bio: user.bio || undefined,
				})),
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to search users",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`search.searchUsers failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return { users: [], traceId };
		}
	},
};
