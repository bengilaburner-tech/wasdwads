import type { IFollowsService } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
	getFollowerCount,
	getFollowingCount,
	getFollowStatus,
	toggleFollow,
} from "../../services/follows.service";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode } from "../../services/error";

export const followsHandler: IFollowsService = {
	async toggleFollow(request) {
		const traceId = generateTraceId();
		Logger.request("follows.toggleFollow", traceId, { username: request.username });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await toggleFollow(request.username, auth.userId);

			Logger.response("follows.toggleFollow", traceId, Date.now(), true, {
				following: result.following,
			});

			return {
				success: true,
				following: result.following,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to toggle follow",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`follows.toggleFollow failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				following: false,
				error: appError.message,
				traceId,
			};
		}
	},

	async getFollowStatus(request) {
		const traceId = generateTraceId();
		Logger.request("follows.getFollowStatus", traceId, { username: request.username });

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getFollowStatus(request.username, auth.userId);

			Logger.response("follows.getFollowStatus", traceId, Date.now(), true);

			return { following: result.following, traceId };
		} catch {
			Logger.warn(`follows.getFollowStatus failed`, traceId);
			return { following: false, traceId };
		}
	},

	async getFollowerCount(request) {
		const traceId = generateTraceId();
		Logger.request("follows.getFollowerCount", traceId, { username: request.username });

		try {
			const result = await getFollowerCount(request.username);
			Logger.response("follows.getFollowerCount", traceId, Date.now(), true, {
				count: result.count,
			});
			return { count: result.count, traceId };
		} catch {
			Logger.warn(`follows.getFollowerCount failed`, traceId);
			return { count: 0, traceId };
		}
	},

	async getFollowingCount(request) {
		const traceId = generateTraceId();
		Logger.request("follows.getFollowingCount", traceId, { username: request.username });

		try {
			const result = await getFollowingCount(request.username);
			Logger.response("follows.getFollowingCount", traceId, Date.now(), true, {
				count: result.count,
			});
			return { count: result.count, traceId };
		} catch {
			Logger.warn(`follows.getFollowingCount failed`, traceId);
			return { count: 0, traceId };
		}
	},
};
