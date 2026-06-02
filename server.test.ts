import { Logger, createTraceContext, setTraceContext } from "../services/tracing";
import { AppError, ErrorCode, isAppError } from "../services/error";

/**
 * Request/response wrapper to inject tracing and unified error handling
 */
export interface HandlerRequest {
	traceId: string;
	sessionToken?: string;
	[key: string]: unknown;
}

export interface HandlerResponse {
	success?: boolean;
	error?: string;
	traceId?: string;
	[key: string]: unknown;
}

/**
 * Wraps a handler method with tracing, error handling, and response mapping.
 * Catches all errors and converts them to AppError with proper gRPC status mapping.
 * Returns a response that includes the trace ID for client correlation.
 */
export function createHandlerWrapper<TRequest extends Record<string, unknown>, TResponse>(
	handlerName: string,
	handler: (req: TRequest & HandlerRequest) => Promise<TResponse | void>,
) {
	return async (request: TRequest & Record<string, unknown>): Promise<TResponse & HandlerResponse> => {
		const traceId = generateRequestTraceId();
		const context = createTraceContext({ endpoint: handlerName });
		const startTime = context.startTime;

		Logger.request(handlerName, traceId, {
			endpoint: handlerName,
		});

		try {
			const wrappedRequest = {
				...(request as TRequest),
				traceId,
			};

			setTraceContext(wrappedRequest, context);

			const result = await handler(wrappedRequest as TRequest & HandlerRequest);

			Logger.response(handlerName, traceId, startTime, true, {
				endpoint: handlerName,
			});

			return {
				...(result as object),
				traceId,
			} as TResponse & HandlerResponse;
		} catch (error) {
			const appError = toAppError(error, traceId);

			Logger.error(
				`${handlerName} failed: ${appError.message}`,
				traceId,
				error instanceof Error ? error : new Error(String(error)),
				{
					code: appError.code,
					context: appError.context,
				},
			);

			Logger.response(handlerName, traceId, startTime, false, {
				endpoint: handlerName,
				error: appError.code,
			});

			throw appError;
		}
	};
}

function generateRequestTraceId(): string {
	return Math.random().toString(36).substring(2, 15);
}

/**
 * Convert any error to AppError with tracing context
 */
function toAppError(error: unknown, traceId: string): AppError {
	if (isAppError(error)) {
		if (!error.traceId) {
			return new AppError(error.message, error.code, traceId, error.context);
		}
		return error;
	}

	if (error instanceof Error) {
		const message = error.message;

		// Map common error patterns to codes
		if (message.includes("not found") || message.includes("User not found")) {
			return new AppError(message, ErrorCode.NOT_FOUND, traceId, { originalError: message });
		}
		if (message.includes("already exists") || message.includes("unique")) {
			return new AppError(message, ErrorCode.DUPLICATE_ENTRY, traceId, {
				originalError: message,
			});
		}
		if (message.includes("unauthorized") || message.includes("invalid session")) {
			return new AppError(message, ErrorCode.UNAUTHORIZED, traceId, {
				originalError: message,
			});
		}
		if (message.includes("forbidden") || message.includes("permission denied")) {
			return new AppError(message, ErrorCode.FORBIDDEN, traceId, { originalError: message });
		}
		if (message.includes("validation failed")) {
			return new AppError(message, ErrorCode.VALIDATION_ERROR, traceId, {
				originalError: message,
			});
		}

		return new AppError(message, ErrorCode.INTERNAL, traceId, { originalError: message });
	}

	return new AppError(
		"An unknown error occurred",
		ErrorCode.INTERNAL,
		traceId,
		{ originalError: String(error) },
	);
}

/**
 * Safe error response for handlers that return errors instead of throwing
 */
export function createErrorResponse(
	error: unknown,
	traceId: string,
): Record<string, unknown> {
	const appError = toAppError(error, traceId);
	return {
		success: false,
		error: appError.message,
		errorCode: appError.code,
		traceId,
	};
}
