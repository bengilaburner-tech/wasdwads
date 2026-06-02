import type { INotificationsService } from "@chirp/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
	deleteNotification,
	getUnreadCount,
	getUserNotifications,
	markAllAsRead,
	markAsRead,
} from "../../services/notifications.service";
import { toProtoTimestamp } from "../../services/utils";
import { Logger, generateTraceId } from "../../services/tracing";
import { AppError, ErrorCode } from "../../services/error";

export const notificationsHandler: INotificationsService = {
	async getNotifications(request) {
		const traceId = generateTraceId();
		Logger.request("notifications.getNotifications", traceId, {
			limit: request.limit,
			offset: request.offset,
		});

		try {
			const auth = validateSessionToken(request.sessionToken);
			const notifications = await getUserNotifications(
				auth.userId,
				request.limit || 20,
				request.offset || 0,
			);

			Logger.response("notifications.getNotifications", traceId, Date.now(), true, {
				notificationCount: notifications.length,
			});

			return {
				notifications: notifications.map((n) => ({
					id: n.id,
					type: n.type,
					read: n.read,
					actor: n.actor
						? {
								id: n.actor.id,
								username: n.actor.username,
								displayName: n.actor.displayName,
								avatarUrl: n.actor.avatarUrl || undefined,
							}
						: undefined,
					postId: n.postId || undefined,
					commentId: n.commentId || undefined,
					postContent: n.postContent || undefined,
					commentContent: n.commentContent || undefined,
					createdAt: toProtoTimestamp(n.createdAt),
				})),
				traceId,
			};
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to get notifications",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`notifications.getNotifications failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : undefined,
				{ code: appError.code },
			);

			return { notifications: [], traceId };
		}
	},

	async getUnreadCount(request) {
		const traceId = generateTraceId();
		Logger.request("notifications.getUnreadCount", traceId);

		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getUnreadCount(auth.userId);

			Logger.response("notifications.getUnreadCount", traceId, Date.now(), true, {
				count: result.count,
			});

			return { count: result.count, traceId };
		} catch {
			Logger.warn(`notifications.getUnreadCount failed`, traceId);
			return { count: 0, traceId };
		}
	},

	async markAsRead(request) {
		const traceId = generateTraceId();
		Logger.request("notifications.markAsRead", traceId, { notificationId: request.notificationId });

		try {
			const auth = validateSessionToken(request.sessionToken);
			await markAsRead(request.notificationId, auth.userId);

			Logger.response("notifications.markAsRead", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to mark as read",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`notifications.markAsRead failed: ${appError.message}`,
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

	async markAllAsRead(request) {
		const traceId = generateTraceId();
		Logger.request("notifications.markAllAsRead", traceId);

		try {
			const auth = validateSessionToken(request.sessionToken);
			await markAllAsRead(auth.userId);

			Logger.response("notifications.markAllAsRead", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to mark all as read",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`notifications.markAllAsRead failed: ${appError.message}`,
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

	async deleteNotification(request) {
		const traceId = generateTraceId();
		Logger.request("notifications.deleteNotification", traceId, {
			notificationId: request.notificationId,
		});

		try {
			const auth = validateSessionToken(request.sessionToken);
			await deleteNotification(request.notificationId, auth.userId);

			Logger.response("notifications.deleteNotification", traceId, Date.now(), true);

			return { success: true, traceId };
		} catch (error) {
			const appError = error instanceof AppError
				? error
				: new AppError(
					error instanceof Error ? error.message : "Failed to delete notification",
					ErrorCode.INTERNAL,
					traceId,
				);

			Logger.error(
				`notifications.deleteNotification failed: ${appError.message}`,
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
