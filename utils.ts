import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AppError, ErrorCode, isAppError } from "../services/error";
import { generateTraceId, createTraceContext, Logger } from "../services/tracing";

describe("Error Handling & Observability System", () => {
	describe("ErrorCode Enum", () => {
		it("should define all client error codes", () => {
			expect(ErrorCode.INVALID_ARGUMENT).toBe("INVALID_ARGUMENT");
			expect(ErrorCode.UNAUTHORIZED).toBe("UNAUTHORIZED");
			expect(ErrorCode.FORBIDDEN).toBe("FORBIDDEN");
			expect(ErrorCode.NOT_FOUND).toBe("NOT_FOUND");
			expect(ErrorCode.ALREADY_EXISTS).toBe("ALREADY_EXISTS");
		});

		it("should define all server error codes", () => {
			expect(ErrorCode.INTERNAL).toBe("INTERNAL");
			expect(ErrorCode.DATABASE_ERROR).toBe("DATABASE_ERROR");
			expect(ErrorCode.SERVICE_UNAVAILABLE).toBe("SERVICE_UNAVAILABLE");
		});
	});

	describe("AppError Class", () => {
		it("should create error with default code (INTERNAL)", () => {
			const error = new AppError("Something went wrong", undefined, "trace-123");
			expect(error.message).toBe("Something went wrong");
			expect(error.code).toBe(ErrorCode.INTERNAL);
			expect(error.traceId).toBe("trace-123");
		});

		it("should create error with specific code", () => {
			const error = new AppError(
				"User not found",
				ErrorCode.NOT_FOUND,
				"trace-456",
			);
			expect(error.message).toBe("User not found");
			expect(error.code).toBe(ErrorCode.NOT_FOUND);
		});

		it("should include context in error", () => {
			const context = { userId: "user-123", action: "fetch" };
			const error = new AppError(
				"Failed to fetch user",
				ErrorCode.NOT_FOUND,
				"trace-789",
				context,
			);
			expect(error.context).toEqual(context);
		});

		it("should map ErrorCode.NOT_FOUND to gRPC NOT_FOUND", () => {
			const error = new AppError("Not found", ErrorCode.NOT_FOUND, "trace-1");
			expect(error.statusCode).toBe(404);
		});

		it("should map ErrorCode.UNAUTHORIZED to gRPC UNAUTHENTICATED", () => {
			const error = new AppError("Unauthorized", ErrorCode.UNAUTHORIZED, "trace-2");
			expect(error.statusCode).toBe(401);
		});

		it("should map ErrorCode.FORBIDDEN to gRPC PERMISSION_DENIED", () => {
			const error = new AppError("Forbidden", ErrorCode.FORBIDDEN, "trace-3");
			expect(error.statusCode).toBe(403);
		});

		it("should map ErrorCode.VALIDATION_ERROR to gRPC INVALID_ARGUMENT", () => {
			const error = new AppError("Validation failed", ErrorCode.VALIDATION_ERROR, "trace-4");
			expect(error.statusCode).toBe(400);
		});

		it("should map ErrorCode.DUPLICATE_ENTRY to gRPC ALREADY_EXISTS", () => {
			const error = new AppError("Already exists", ErrorCode.DUPLICATE_ENTRY, "trace-5");
			expect(error.statusCode).toBe(409);
		});

		it("should map ErrorCode.INTERNAL to gRPC INTERNAL", () => {
			const error = new AppError("Internal error", ErrorCode.INTERNAL, "trace-6");
			expect(error.statusCode).toBe(500);
		});

		it("should map ErrorCode.RESOURCE_EXHAUSTED to gRPC RESOURCE_EXHAUSTED", () => {
			const error = new AppError("Rate limit", ErrorCode.RESOURCE_EXHAUSTED, "trace-7");
			expect(error.statusCode).toBe(429);
		});

		it("should map ErrorCode.BUSINESS_RULE_VIOLATION to gRPC FAILED_PRECONDITION", () => {
			const error = new AppError(
				"Cannot follow yourself",
				ErrorCode.BUSINESS_RULE_VIOLATION,
				"trace-8",
			);
			expect(error.statusCode).toBe(412);
		});
	});

	describe("isAppError Type Guard", () => {
		it("should return true for AppError instances", () => {
			const error = new AppError("Test error", ErrorCode.INTERNAL, "trace-1");
			expect(isAppError(error)).toBe(true);
		});

		it("should return false for regular Error instances", () => {
			const error = new Error("Test error");
			expect(isAppError(error)).toBe(false);
		});

		it("should return false for null/undefined", () => {
			expect(isAppError(null)).toBe(false);
			expect(isAppError(undefined)).toBe(false);
		});

		it("should return false for plain objects", () => {
			expect(isAppError({ message: "test" })).toBe(false);
		});
	});

	describe("Trace ID Generation", () => {
		it("should generate unique trace IDs", () => {
			const id1 = generateTraceId();
			const id2 = generateTraceId();

			expect(id1).toBeDefined();
			expect(id2).toBeDefined();
			expect(id1).not.toBe(id2);
		});

		it("should generate trace IDs of reasonable length", () => {
			const id = generateTraceId();
			// UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
			expect(id.length).toBeGreaterThan(20);
		});
	});

	describe("Trace Context", () => {
		it("should create trace context with generated ID", () => {
			const context = createTraceContext();
			expect(context.traceId).toBeDefined();
			expect(context.startTime).toBeGreaterThan(0);
			expect(context.metadata).toEqual({});
		});

		it("should include metadata in trace context", () => {
			const metadata = { userId: "user-123", endpoint: "auth.login" };
			const context = createTraceContext(metadata);
			expect(context.metadata).toEqual(metadata);
		});

		it("should have current timestamp", () => {
			const before = Date.now();
			const context = createTraceContext();
			const after = Date.now();

			expect(context.startTime).toBeGreaterThanOrEqual(before);
			expect(context.startTime).toBeLessThanOrEqual(after);
		});
	});

	describe("Logger Class", () => {
		let logSpy: any;
		let warnSpy: any;
		let errorSpy: any;

		beforeEach(() => {
			logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		});

		afterEach(() => {
			logSpy.mockRestore();
			warnSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it("should log info message with trace ID", () => {
			Logger.info("Test message", "trace-123");

			expect(logSpy).toHaveBeenCalled();
			const logged = JSON.parse(logSpy.mock.calls[0][0]);
			expect(logged.level).toBe("info");
			expect(logged.message).toBe("Test message");
			expect(logged.traceId).toBe("trace-123");
		});

		it("should log request with endpoint", () => {
			Logger.request("auth.login", "trace-456", { email: "user@test.com" });

			expect(logSpy).toHaveBeenCalled();
			const logged = JSON.parse(logSpy.mock.calls[0][0]);
			expect(logged.message).toContain("request started");
			expect(logged.context.endpoint).toBe("auth.login");
			expect(logged.context.email).toBe("user@test.com");
		});

		it("should log response with duration", () => {
			const startTime = Date.now();
			Logger.response("auth.login", "trace-789", startTime, true, { userId: "user-123" });

			expect(logSpy).toHaveBeenCalled();
			const logged = JSON.parse(logSpy.mock.calls[0][0]);
			expect(logged.message).toContain("request completed");
			expect(logged.context.endpoint).toBe("auth.login");
			expect(logged.context.userId).toBe("user-123");
			expect(logged.context.success).toBe(true);
			expect(typeof logged.context.duration).toBe("number");
		});

		it("should log error with stack trace", () => {
			const testError = new Error("Test error message");
			Logger.error("Operation failed", "trace-999", testError, { action: "test" });

			expect(errorSpy).toHaveBeenCalled();
			const logged = JSON.parse(errorSpy.mock.calls[0][0]);
			expect(logged.level).toBe("error");
			expect(logged.message).toBe("Operation failed");
			expect(logged.error.message).toBe("Test error message");
			expect(logged.error.stack).toBeDefined();
		});

		it("should include timestamp in ISO format", () => {
			Logger.info("Test", "trace-1");

			expect(logSpy).toHaveBeenCalled();
			const logged = JSON.parse(logSpy.mock.calls[0][0]);
			const timestamp = new Date(logged.timestamp);
			expect(timestamp.toISOString()).toBeDefined();
		});

		it("should log warn level", () => {
			Logger.warn("Warning message", "trace-2");

			expect(warnSpy).toHaveBeenCalled();
			const logged = JSON.parse(warnSpy.mock.calls[0][0]);
			expect(logged.level).toBe("warn");
			expect(logged.message).toBe("Warning message");
		});
	});

	describe("Error Handling Pattern Integration", () => {
		it("should handle AppError in try-catch", () => {
			const testHandler = async () => {
				const traceId = generateTraceId();
				try {
					throw new AppError(
						"User not found",
						ErrorCode.NOT_FOUND,
						traceId,
					);
				} catch (error) {
					if (isAppError(error)) {
						return {
							success: false,
							error: error.message,
							errorCode: error.code,
							traceId: error.traceId,
						};
					}
					throw error;
				}
			};

			const result = testHandler();
			expect(result).resolves.toEqual({
				success: false,
				error: "User not found",
				errorCode: ErrorCode.NOT_FOUND,
				traceId: expect.any(String),
			});
		});

		it("should classify regular Error to AppError", () => {
			const regularError = new Error("Something failed");
			const traceId = generateTraceId();

			const appError = regularError instanceof AppError
				? regularError
				: new AppError(
					regularError.message,
					ErrorCode.INTERNAL,
					traceId,
				);

			expect(isAppError(appError)).toBe(true);
			expect(appError.code).toBe(ErrorCode.INTERNAL);
		});

		it("should preserve trace ID through error chain", () => {
			const traceId = generateTraceId();
			const error1 = new AppError("First error", ErrorCode.NOT_FOUND, traceId);

			// If error1 is re-thrown with new context
			const error2 = new AppError(
				`Failed operation: ${error1.message}`,
				ErrorCode.INTERNAL,
				traceId,
				{ originalError: error1.code },
			);

			expect(error2.traceId).toBe(traceId);
			expect(error2.context.originalError).toBe(ErrorCode.NOT_FOUND);
		});
	});

	describe("Response Contract", () => {
		it("should include trace ID in success response", () => {
			const traceId = generateTraceId();
			const response = {
				success: true,
				data: { id: "123", name: "Test" },
				traceId,
			};

			expect(response.traceId).toBe(traceId);
			expect(response.success).toBe(true);
		});

		it("should include trace ID and error code in error response", () => {
			const traceId = generateTraceId();
			const response = {
				success: false,
				error: "User not found",
				errorCode: ErrorCode.NOT_FOUND,
				traceId,
			};

			expect(response.traceId).toBe(traceId);
			expect(response.errorCode).toBe(ErrorCode.NOT_FOUND);
			expect(response.error).toBeDefined();
		});
	});
});
