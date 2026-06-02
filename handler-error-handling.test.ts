import type {
	AdminUserResponse,
	AuditLogResponse,
	IAdminService,
	ReportResponse,
} from "@chirp/proto";
import { requireAdmin, validateSessionToken } from "../../middleware/auth";
import {
	banUser,
	deleteCommentAdmin,
	deletePostAdmin,
	deleteUser,
	getAuditLogs,
	getDashboardStats,
	getReport,
	getUserDetails,
	listReports,
	listUsers,
	reviewReport,
	unbanUser,
	updateUserRole,
} from "../../services/admin.service";
import { toProtoTimestamp } from "../../services/utils";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode } from "../../services/error";

function toAdminUserResponse(user: any): AdminUserResponse {
	return {
		id: user.id,
		email: user.email,
		username: user.username,
		displayName: user.displayName,
		avatarUrl: user.avatarUrl || undefined,
		bio: user.bio || undefined,
		role: user.role,
		createdAt: toProtoTimestamp(user.createdAt),
		updatedAt: toProtoTimestamp(user.updatedAt),
		bannedAt: user.bannedAt ? toProtoTimestamp(user.bannedAt) : undefined,
		bannedReason: user.bannedReason || undefined,
		postCount: user.postCount || 0,
		commentCount: user.commentCount || 0,
	};
}

function toReportResponse(report: any): ReportResponse {
	return {
		id: report.id,
		reporterId: report.reporterId,
		reporterUsername: report.reporterUsername,
		targetType: report.targetType,
		targetId: report.targetId,
		reason: report.reason,
		description: report.description || undefined,
		status: report.status,
		reviewedBy: report.reviewedBy || undefined,
		reviewedAt: report.reviewedAt ? toProtoTimestamp(report.reviewedAt) : undefined,
		createdAt: toProtoTimestamp(report.createdAt),
	};
}

function toAuditLogResponse(log: any): AuditLogResponse {
	return {
		id: log.id,
		adminId: log.adminId,
		adminUsername: log.adminUsername,
		action: log.action,
		targetType: log.targetType || undefined,
		targetId: log.targetId || undefined,
		details: log.details || undefined,
		ipAddress: log.ipAddress || undefined,
		createdAt: toProtoTimestamp(log.createdAt),
	};
}

export const adminHandler: IAdminService = {
	async listUsers(request) {
		const traceId = generateTraceId();
		Logger.request("admin.listUsers", traceId, { searchQuery: request.searchQuery });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			const result = await listUsers({
				limit: request.pagination?.limit || 20,
				offset: request.pagination?.offset || 0,
				searchQuery: request.searchQuery || undefined,
				roleFilter: request.roleFilter || undefined,
			});

			Logger.response("admin.listUsers", traceId, Date.now(), true, {
				userCount: result.users.length,
				total: result.total,
			});

			return {
				users: result.users.map(toAdminUserResponse),
				total: result.total,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to list users",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.listUsers failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async getUserDetails(request) {
		const traceId = generateTraceId();
		Logger.request("admin.getUserDetails", traceId, { userId: request.userId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			const user = await getUserDetails(request.userId);

			Logger.response("admin.getUserDetails", traceId, Date.now(), true, {
				userId: user.id,
			});

			return {
				user: toAdminUserResponse(user),
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get user details",
					ErrorCode.NOT_FOUND,
					traceId,
				);

			Logger.error(
				`admin.getUserDetails failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async banUser(request) {
		const traceId = generateTraceId();
		Logger.request("admin.banUser", traceId, { userId: request.userId, reason: request.reason });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await banUser(request.userId, request.reason, auth.userId);

			Logger.response("admin.banUser", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to ban user",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.banUser failed: ${appError.message}`,
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

	async unbanUser(request) {
		const traceId = generateTraceId();
		Logger.request("admin.unbanUser", traceId, { userId: request.userId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await unbanUser(request.userId, auth.userId);

			Logger.response("admin.unbanUser", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to unban user",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.unbanUser failed: ${appError.message}`,
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

	async updateUserRole(request) {
		const traceId = generateTraceId();
		Logger.request("admin.updateUserRole", traceId, { userId: request.userId, role: request.role });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await updateUserRole(request.userId, request.role, auth.userId);

			Logger.response("admin.updateUserRole", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to update role",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.updateUserRole failed: ${appError.message}`,
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

	async deleteUser(request) {
		const traceId = generateTraceId();
		Logger.request("admin.deleteUser", traceId, { userId: request.userId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await deleteUser(request.userId, auth.userId);

			Logger.response("admin.deleteUser", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to delete user",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.deleteUser failed: ${appError.message}`,
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

	async deletePostAdmin(request) {
		const traceId = generateTraceId();
		Logger.request("admin.deletePostAdmin", traceId, { postId: request.postId, reason: request.reason });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await deletePostAdmin(request.postId, request.reason, auth.userId);

			Logger.response("admin.deletePostAdmin", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to delete post",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.deletePostAdmin failed: ${appError.message}`,
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

	async deleteCommentAdmin(request) {
		const traceId = generateTraceId();
		Logger.request("admin.deleteCommentAdmin", traceId, {
			commentId: request.commentId,
			reason: request.reason,
		});

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await deleteCommentAdmin(request.commentId, request.reason, auth.userId);

			Logger.response("admin.deleteCommentAdmin", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to delete comment",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.deleteCommentAdmin failed: ${appError.message}`,
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

	async listReports(request) {
		const traceId = generateTraceId();
		Logger.request("admin.listReports", traceId, { statusFilter: request.statusFilter });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			const result = await listReports({
				limit: request.pagination?.limit || 20,
				offset: request.pagination?.offset || 0,
				statusFilter: request.statusFilter || undefined,
				typeFilter: request.typeFilter || undefined,
			});

			Logger.response("admin.listReports", traceId, Date.now(), true, {
				reportCount: result.reports.length,
				total: result.total,
			});

			return {
				reports: result.reports.map(toReportResponse),
				total: result.total,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to list reports",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.listReports failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async getReport(request) {
		const traceId = generateTraceId();
		Logger.request("admin.getReport", traceId, { reportId: request.reportId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			const report = await getReport(request.reportId);

			Logger.response("admin.getReport", traceId, Date.now(), true);

			return { ...toReportResponse(report), traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get report",
					ErrorCode.NOT_FOUND,
					traceId,
				);

			Logger.error(
				`admin.getReport failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async reviewReport(request) {
		const traceId = generateTraceId();
		Logger.request("admin.reviewReport", traceId, { reportId: request.reportId, action: request.action });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await reviewReport(request.reportId, request.action, auth.userId, request.notes || undefined);

			Logger.response("admin.reviewReport", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to review report",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.reviewReport failed: ${appError.message}`,
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

	async getDashboardStats(request) {
		const traceId = generateTraceId();
		Logger.request("admin.getDashboardStats", traceId);

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			const stats = await getDashboardStats();

			Logger.response("admin.getDashboardStats", traceId, Date.now(), true, {
				totalUsers: stats.totalUsers,
				totalPosts: stats.totalPosts,
			});

			return {
				totalUsers: stats.totalUsers,
				totalPosts: stats.totalPosts,
				totalComments: stats.totalComments,
				pendingReports: stats.pendingReports,
				newUsersToday: stats.newUsersToday,
				newPostsToday: stats.newPostsToday,
				bannedUsers: stats.bannedUsers,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get dashboard stats",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.getDashboardStats failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},

	async getAuditLogs(request) {
		const traceId = generateTraceId();
		Logger.request("admin.getAuditLogs", traceId, { actionFilter: request.actionFilter });

		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			const result = await getAuditLogs({
				limit: request.pagination?.limit || 50,
				offset: request.pagination?.offset || 0,
				adminIdFilter: request.adminIdFilter || undefined,
				actionFilter: request.actionFilter || undefined,
			});

			Logger.response("admin.getAuditLogs", traceId, Date.now(), true, {
				logCount: result.logs.length,
				total: result.total,
			});

			return {
				logs: result.logs.map(toAuditLogResponse),
				total: result.total,
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get audit logs",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`admin.getAuditLogs failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			throw appError;
		}
	},
};
