import type { IUsersService } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import { getUser, updateProfile } from "../../services/users.service";
import { toProtoTimestamp } from "../../services/utils";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode } from "../../services/error";

export const usersHandler: IUsersService = {
	async getUser(request) {
		const traceId = generateTraceId();
		Logger.request("users.getUser", traceId, { username: request.username });

		try {
			let userId: string | undefined;
			if (request.sessionToken) {
				try {
					const auth = validateSessionToken(request.sessionToken);
					userId = auth.userId;
				} catch {
					// Ignore invalid token for public access
					Logger.debug("Invalid session token for getUser", traceId);
				}
			}

			const user = await getUser(request.username, userId);

			Logger.response("users.getUser", traceId, Date.now(), true, { userId: user.id });

			return {
				id: user.id,
				email: user.email,
				username: user.username,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl || undefined,
				bio: user.bio || undefined,
				role: user.role,
				createdAt: toProtoTimestamp(user.createdAt),
				followerCount: user.followerCount,
				followingCount: user.followingCount,
				postCount: user.postCount,
				isFollowing: user.isFollowing,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get user",
					ErrorCode.NOT_FOUND,
					traceId,
				);

			Logger.error(
				`users.getUser failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async updateProfile(request) {
		const traceId = generateTraceId();
		Logger.request("users.updateProfile", traceId);

		try {
			const auth = validateSessionToken(request.sessionToken);
			await updateProfile({
				userId: auth.userId,
				displayName: request.displayName || undefined,
				bio: request.bio || undefined,
				avatarUrl: request.avatarUrl || undefined,
			});

			Logger.response("users.updateProfile", traceId, Date.now(), true, {
				userId: auth.userId,
			});

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to update profile",
					error instanceof Error && error.message.includes("validation")
						? ErrorCode.VALIDATION_ERROR
						: ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`users.updateProfile failed: ${appError.message}`,
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
