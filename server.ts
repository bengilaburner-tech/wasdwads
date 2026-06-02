import type { ILikesService } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
	getCommentLikeStatus,
	getPostLikeStatus,
	toggleCommentLike,
	togglePostLike,
} from "../../services/likes.service";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode } from "../../services/error";

export const likesHandler: ILikesService = {
	async togglePostLike(request) {
		const traceId = generateTraceId();
		Logger.request("likes.togglePostLike", traceId, { postId: request.postId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await togglePostLike(request.postId, auth.userId);

			Logger.response("likes.togglePostLike", traceId, Date.now(), true, {
				liked: result.liked,
			});

			return {
				success: true,
				liked: result.liked,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to toggle like",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`likes.togglePostLike failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				liked: false,
				error: appError.message,
				traceId,
			};
		}
	},

	async toggleCommentLike(request) {
		const traceId = generateTraceId();
		Logger.request("likes.toggleCommentLike", traceId, { commentId: request.commentId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await toggleCommentLike(request.commentId, auth.userId);

			Logger.response("likes.toggleCommentLike", traceId, Date.now(), true, {
				liked: result.liked,
			});

			return {
				success: true,
				liked: result.liked,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to toggle like",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`likes.toggleCommentLike failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				liked: false,
				error: appError.message,
				traceId,
			};
		}
	},

	async getPostLikeStatus(request) {
		const traceId = generateTraceId();
		Logger.request("likes.getPostLikeStatus", traceId, { postId: request.postId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getPostLikeStatus(request.postId, auth.userId);

			Logger.response("likes.getPostLikeStatus", traceId, Date.now(), true);

			return { liked: result.liked, traceId };
		} catch {
			Logger.warn(`likes.getPostLikeStatus failed`, traceId);
			return { liked: false, traceId };
		}
	},

	async getCommentLikeStatus(request) {
		const traceId = generateTraceId();
		Logger.request("likes.getCommentLikeStatus", traceId, { commentId: request.commentId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getCommentLikeStatus(request.commentId, auth.userId);

			Logger.response("likes.getCommentLikeStatus", traceId, Date.now(), true);

			return { liked: result.liked, traceId };
		} catch {
			Logger.warn(`likes.getCommentLikeStatus failed`, traceId);
			return { liked: false, traceId };
		}
	},
};
