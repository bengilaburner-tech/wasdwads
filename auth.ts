import type { IPostsService, PostResponse } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
	createPost,
	deletePost,
	getPost,
	getPosts,
	getUserPosts,
	updatePost,
} from "../../services/posts.service";
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

export const postsHandler: IPostsService = {
	async createPost(request) {
		const traceId = generateTraceId();
		Logger.request("posts.createPost", traceId, { contentLength: request.content?.length });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await createPost({
				content: request.content,
				authorId: auth.userId,
			});

			Logger.response("posts.createPost", traceId, Date.now(), true, {
				postId: result.postId,
			});

			return {
				success: true,
				postId: result.postId,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to create post",
					error instanceof Error && error.message.includes("validation")
						? ErrorCode.VALIDATION_ERROR
						: ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`posts.createPost failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				postId: "",
				error: appError.message,
				traceId,
			};
		}
	},

	async getPost(request) {
		const traceId = generateTraceId();
		Logger.request("posts.getPost", traceId, { postId: request.postId });

		try {
			let userId: string | undefined;
			if (request.sessionToken) {
				try {
					const auth = validateSessionToken(request.sessionToken);
					userId = auth.userId;
				} catch {
					// Ignore invalid token for public access
					Logger.debug("Invalid session token for getPost", traceId);
				}
			}

			const post = await getPost(request.postId, userId);
			Logger.response("posts.getPost", traceId, Date.now(), true);
			return toPostResponse(post);
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get post",
					ErrorCode.NOT_FOUND,
					traceId,
				);

			Logger.error(
				`posts.getPost failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async updatePost(request) {
		const traceId = generateTraceId();
		Logger.request("posts.updatePost", traceId, { postId: request.postId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			await updatePost({
				postId: request.postId,
				content: request.content,
				userId: auth.userId,
			});

			Logger.response("posts.updatePost", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to update post",
					error instanceof Error && error.message.includes("permission")
						? ErrorCode.PERMISSION_DENIED
						: ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`posts.updatePost failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				error: appError.message,
				traceId,
			};
		}
	},

	async deletePost(request) {
		const traceId = generateTraceId();
		Logger.request("posts.deletePost", traceId, { postId: request.postId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			await deletePost(request.postId, auth.userId);

			Logger.response("posts.deletePost", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to delete post",
					error instanceof Error && error.message.includes("permission")
						? ErrorCode.PERMISSION_DENIED
						: ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`posts.deletePost failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				error: appError.message,
				traceId,
			};
		}
	},

	async getPosts(request) {
		const traceId = generateTraceId();
		Logger.request("posts.getPosts", traceId, {
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
					Logger.debug("Invalid session token for getPosts", traceId);
				}
			}

			const posts = await getPosts({
				limit: request.pagination?.limit || 20,
				offset: request.pagination?.offset || 0,
				userId,
			});

			Logger.response("posts.getPosts", traceId, Date.now(), true, {
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
					error instanceof Error ? error.message : "Failed to get posts",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`posts.getPosts failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async getUserPosts(request) {
		const traceId = generateTraceId();
		Logger.request("posts.getUserPosts", traceId, { username: request.username });

		try {
			let userId: string | undefined;
			if (request.sessionToken) {
				try {
					const auth = validateSessionToken(request.sessionToken);
					userId = auth.userId;
				} catch {
					// Ignore invalid token for public access
					Logger.debug("Invalid session token for getUserPosts", traceId);
				}
			}

			const posts = await getUserPosts(request.username, userId);

			Logger.response("posts.getUserPosts", traceId, Date.now(), true, {
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
					error instanceof Error ? error.message : "Failed to get user posts",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`posts.getUserPosts failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},
};
