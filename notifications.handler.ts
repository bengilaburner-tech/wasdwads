import type { CommentResponse, ICommentsService } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import { createComment, deleteComment, getPostComments } from "../../services/comments.service";
import { toProtoTimestamp } from "../../services/utils";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode } from "../../services/error";

function toCommentResponse(comment: any): CommentResponse {
	return {
		id: comment.id,
		content: comment.content,
		createdAt: toProtoTimestamp(comment.createdAt),
		parentId: comment.parentId || undefined,
		author: comment.author
			? {
					id: comment.author.id || "",
					username: comment.author.username || "",
					displayName: comment.author.displayName || "",
					avatarUrl: comment.author.avatarUrl || undefined,
				}
			: { id: "", username: "", displayName: "" },
		likeCount: comment.likeCount || 0,
		isLiked: comment.isLiked || false,
		replies: (comment.replies || []).map(toCommentResponse),
	};
}

export const commentsHandler: ICommentsService = {
	async createComment(request) {
		const traceId = generateTraceId();
		Logger.request("comments.createComment", traceId, {
			postId: request.postId,
			contentLength: request.content?.length,
		});

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await createComment({
				postId: request.postId,
				content: request.content,
				authorId: auth.userId,
				parentId: request.parentId || undefined,
			});

			Logger.response("comments.createComment", traceId, Date.now(), true, {
				commentId: result.commentId,
			});

			return {
				success: true,
				commentId: result.commentId,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to create comment",
					error instanceof Error && error.message.includes("validation")
						? ErrorCode.VALIDATION_ERROR
						: ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`comments.createComment failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				commentId: "",
				error: appError.message,
				traceId,
			};
		}
	},

	async getPostComments(request) {
		const traceId = generateTraceId();
		Logger.request("comments.getPostComments", traceId, { postId: request.postId });

		try {
			let userId: string | undefined;
			if (request.sessionToken) {
				try {
					const auth = validateSessionToken(request.sessionToken);
					userId = auth.userId;
				} catch {
					// Ignore invalid token for public access
					Logger.debug("Invalid session token for getPostComments", traceId);
				}
			}

			const comments = await getPostComments(request.postId, userId);

			Logger.response("comments.getPostComments", traceId, Date.now(), true, {
				commentCount: comments.length,
			});

			return {
				comments: comments.map(toCommentResponse),
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get comments",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`comments.getPostComments failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return { comments: [], traceId };
		}
	},

	async deleteComment(request) {
		const traceId = generateTraceId();
		Logger.request("comments.deleteComment", traceId, { commentId: request.commentId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			await deleteComment(request.commentId, auth.userId);

			Logger.response("comments.deleteComment", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to delete comment",
					error instanceof Error && error.message.includes("permission")
						? ErrorCode.PERMISSION_DENIED
						: ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`comments.deleteComment failed: ${appError.message}`,
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
};
