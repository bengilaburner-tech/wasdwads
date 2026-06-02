import type { IAuthService } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import { getCurrentUser, loginUser, registerUser } from "../../services/auth.service";
import { toProtoTimestamp } from "../../services/utils";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode, isAppError } from "../../services/error";

export const authHandler: IAuthService = {
	async register(request) {
		const traceId = generateTraceId();
		Logger.request("auth.register", traceId, {
			email: request.email,
			username: request.username,
		});

		try {
			const result = await registerUser({
				email: request.email,
				username: request.username,
				displayName: request.displayName,
				password: request.password,
			});

			Logger.response("auth.register", traceId, Date.now(), true, {
				userId: result.userId,
			});

			return {
				success: true,
				userId: result.userId,
				sessionToken: result.sessionToken,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Registration failed",
					error instanceof Error && error.message.includes("already exists")
						? ErrorCode.DUPLICATE_ENTRY
						: ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`auth.register failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				userId: "",
				sessionToken: "",
				error: appError.message,
				traceId,
			};
		}
	},

	async login(request) {
		const traceId = generateTraceId();
		Logger.request("auth.login", traceId, { email: request.email });

		try {
			const result = await loginUser({
				email: request.email,
				password: request.password,
			});

			Logger.response("auth.login", traceId, Date.now(), true, {
				userId: result.userId,
			});

			return {
				success: true,
				userId: result.userId,
				sessionToken: result.sessionToken,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Login failed",
					ErrorCode.AUTHENTICATION_FAILED,
					traceId,
				);

			Logger.error(
				`auth.login failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return {
				success: false,
				userId: "",
				sessionToken: "",
				error: appError.message,
				traceId,
			};
		}
	},

	async logout(_request) {
		const traceId = generateTraceId();
		Logger.request("auth.logout", traceId);
		Logger.response("auth.logout", traceId, Date.now(), true);

		// With JWT, logout is handled client-side by removing the token
		return { success: true, traceId };
	},

	async getCurrentUser(request) {
		const traceId = generateTraceId();
		Logger.request("auth.getCurrentUser", traceId);

		try {
			const auth = validateSessionToken(request.sessionToken);
			Logger.debug("Session validated", traceId, { userId: auth.userId });

			const user = await getCurrentUser(auth.userId);

			Logger.response("auth.getCurrentUser", traceId, Date.now(), true, {
				userId: user.id,
			});

			return {
				id: user.id,
				email: user.email,
				username: user.username,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl || undefined,
				bio: user.bio || undefined,
				role: user.role,
				createdAt: toProtoTimestamp(user.createdAt),
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get user",
					request.sessionToken ? ErrorCode.NOT_FOUND : ErrorCode.UNAUTHORIZED,
					traceId,
				);

			Logger.error(
				`auth.getCurrentUser failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async validateSession(request) {
		const traceId = generateTraceId();
		Logger.request("auth.validateSession", traceId);

		try {
			const auth = validateSessionToken(request.sessionToken);
			Logger.response("auth.validateSession", traceId, Date.now(), true, {
				userId: auth.userId,
			});

			return {
				valid: true,
				userId: auth.userId,
				username: auth.username,
				role: auth.role,
				traceId,
			};
		} catch (error) {
			Logger.warn(
				`auth.validateSession: invalid session`,
				traceId,
				{ errorMessage: error instanceof Error ? error.message : "Unknown error" },
			);

			return {
				valid: false,
				userId: "",
				username: "",
				role: "",
				traceId,
			};
		}
	},
};
