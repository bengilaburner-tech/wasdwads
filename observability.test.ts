import { status as gRpcStatus } from "@grpc/grpc-js";

/**
 * Application error codes mapped to gRPC status codes.
 * Establishes a unified error taxonomy across the service.
 */
export enum ErrorCode {
	// Client errors (4xx)
	INVALID_ARGUMENT = "INVALID_ARGUMENT",
	UNAUTHORIZED = "UNAUTHORIZED",
	FORBIDDEN = "FORBIDDEN",
	NOT_FOUND = "NOT_FOUND",
	ALREADY_EXISTS = "ALREADY_EXISTS",
	PERMISSION_DENIED = "PERMISSION_DENIED",
	RESOURCE_EXHAUSTED = "RESOURCE_EXHAUSTED",

	// Server errors (5xx)
	INTERNAL = "INTERNAL",
	DATABASE_ERROR = "DATABASE_ERROR",
	SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

	// Custom application errors
	VALIDATION_ERROR = "VALIDATION_ERROR",
	AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
	SESSION_EXPIRED = "SESSION_EXPIRED",
	DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
	BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION",
}

/**
 * Application error class with code, status mapping, and tracing context.
 */
export class AppError extends Error {
	public readonly code: ErrorCode;
	public readonly grpcStatus: gRpcStatus;
	public readonly statusCode: number;
	public readonly context: Record<string, unknown>;
	public readonly traceId: string;

	constructor(
		message: string,
		code: ErrorCode = ErrorCode.INTERNAL,
		traceId: string = "",
		context: Record<string, unknown> = {},
	) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.traceId = traceId;
		this.context = context;

		const mapping = errorCodeToGrpcStatus(code);
		this.grpcStatus = mapping.grpcStatus;
		this.statusCode = mapping.statusCode;

		Error.captureStackTrace(this, this.constructor);
	}
}

function errorCodeToGrpcStatus(
	code: ErrorCode,
): { grpcStatus: gRpcStatus; statusCode: number } {
	const mapping: Record<ErrorCode, { grpcStatus: gRpcStatus; statusCode: number }> = {
		[ErrorCode.INVALID_ARGUMENT]: {
			grpcStatus: gRpcStatus.INVALID_ARGUMENT,
			statusCode: 400,
		},
		[ErrorCode.UNAUTHORIZED]: {
			grpcStatus: gRpcStatus.UNAUTHENTICATED,
			statusCode: 401,
		},
		[ErrorCode.AUTHENTICATION_FAILED]: {
			grpcStatus: gRpcStatus.UNAUTHENTICATED,
			statusCode: 401,
		},
		[ErrorCode.SESSION_EXPIRED]: {
			grpcStatus: gRpcStatus.UNAUTHENTICATED,
			statusCode: 401,
		},
		[ErrorCode.FORBIDDEN]: {
			grpcStatus: gRpcStatus.PERMISSION_DENIED,
			statusCode: 403,
		},
		[ErrorCode.PERMISSION_DENIED]: {
			grpcStatus: gRpcStatus.PERMISSION_DENIED,
			statusCode: 403,
		},
		[ErrorCode.NOT_FOUND]: {
			grpcStatus: gRpcStatus.NOT_FOUND,
			statusCode: 404,
		},
		[ErrorCode.ALREADY_EXISTS]: {
			grpcStatus: gRpcStatus.ALREADY_EXISTS,
			statusCode: 409,
		},
		[ErrorCode.DUPLICATE_ENTRY]: {
			grpcStatus: gRpcStatus.ALREADY_EXISTS,
			statusCode: 409,
		},
		[ErrorCode.VALIDATION_ERROR]: {
			grpcStatus: gRpcStatus.INVALID_ARGUMENT,
			statusCode: 400,
		},
		[ErrorCode.RESOURCE_EXHAUSTED]: {
			grpcStatus: gRpcStatus.RESOURCE_EXHAUSTED,
			statusCode: 429,
		},
		[ErrorCode.BUSINESS_RULE_VIOLATION]: {
			grpcStatus: gRpcStatus.FAILED_PRECONDITION,
			statusCode: 412,
		},
		[ErrorCode.DATABASE_ERROR]: {
			grpcStatus: gRpcStatus.INTERNAL,
			statusCode: 500,
		},
		[ErrorCode.INTERNAL]: {
			grpcStatus: gRpcStatus.INTERNAL,
			statusCode: 500,
		},
		[ErrorCode.SERVICE_UNAVAILABLE]: {
			grpcStatus: gRpcStatus.UNAVAILABLE,
			statusCode: 503,
		},
	};

	return mapping[code] || { grpcStatus: gRpcStatus.INTERNAL, statusCode: 500 };
}

export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}
