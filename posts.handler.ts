import type { IFeedService, PostResponse } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import { getExploreFeed, getHomeFeed } from "../../services/feed.service";
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

export const feedHandler: IFeedService = {
	async getHomeFeed(request) {
		const traceId = generateTraceId();
		Logger.request("feed.getHomeFeed", traceId, {
			limit: request.pagination?.limit,
			offset: request.pagination?.offset,
		});

		try {
			const auth = validateSessionToken(request.sessionToken);
			const posts = await getHomeFeed(auth.userId, {
				limit: request.pagination?.limit || 20,
				offset: request.pagination?.offset || 0,
			});

			Logger.response("feed.getHomeFeed", traceId, Date.now(), true, {
				postCount: posts.length,
			});

			return {
				posts: posts.map(toPostResponse),
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get home feed",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`feed.getHomeFeed failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async getExploreFeed(request) {
		const traceId = generateTraceId();
		Logger.request("feed.getExploreFeed", traceId, {
			limit: request.pagination?.limit,
			offset: request.pagination?.offset,
		});

		try {
			let userId: string | undefined;
			if (request.sessionToken) {
				try {
					const auth = validateSessionToken(request.sessionToken);
					userId = auth.userId;
				} catch {
					// Ignore invalid token for public access
					Logger.debug("Invalid session token for getExploreFeed", traceId);
				}
			}

			const posts = await getExploreFeed({
				limit: request.pagination?.limit || 20,
				offset: request.pagination?.offset || 0,
				userId,
			});

			Logger.response("feed.getExploreFeed", traceId, Date.now(), true, {
				postCount: posts.length,
			});

			return {
				posts: posts.map(toPostResponse),
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get explore feed",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`feed.getExploreFeed failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},
};
