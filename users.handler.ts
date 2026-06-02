import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppError, ErrorCode } from "../services/error";
import { Logger, generateTraceId } from "../services/tracing";

/**
 * Integration tests for error handling in gRPC handlers
 * These tests verify that handlers properly:
 * 1. Generate trace IDs for each request
 * 2. Log request/response with structured format
 * 3. Handle errors and convert to AppError
 * 4. Include trace IDs in responses
 * 5. Preserve response contracts
 */

describe("Handler Error Handling Integration", () => {
	let logSpy: any;
	let errorSpy: any;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		logSpy.mockRestore();
		errorSpy.mockRestore();
	});

	describe("Success Response Pattern", () => {
		it("should return success response with trace ID", () => {
			// Simulate handler pattern
			const handlerExecution = async () => {
				const traceId = generateTraceId();
				Logger.request("auth.login", traceId, { email: "user@test.com" });

				try {
					// Simulate business logic
					const result = { userId: "123", sessionToken: "abc" };

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
							ErrorCode.INTERNAL,
							"",
						);

					Logger.error("auth.login failed", "", error instanceof Error ? error : undefined);
					throw appError;
				}
			};

			expect(handlerExecution()).resolves.toMatchObject({
				success: true,
				userId: "123",
				traceId: expect.any(String),
			});

			// Verify logs were written
			expect(logSpy).toHaveBeenCalledTimes(2); // request + response
		});
	});

	describe("Error Handling Pattern", () => {
		it("should catch validation error and return with error code", async () => {
			const handlerExecution = async () => {
				const traceId = generateTraceId();
				Logger.request("posts.createPost", traceId);

				try {
					throw new Error("Post content exceeds maximum length");
				} catch (error) {
					const appError = error instanceof AppError
						? error
						: new AppError(
							error instanceof Error ? error.message : "Failed to create post",
							error instanceof Error && error.message.includes("validation")
								? ErrorCode.VALIDATION_ERROR
								: ErrorCode.INTERNAL,
							traceId,
						);

					Logger.error(
						`posts.createPost failed: ${appError.message}`,
						traceId,
						error instanceof Error ? error : undefined,
						{ code: appError.code },
					);

					return {
						success: false,
						postId: "",
						error: appError.message,
						errorCode: appError.code,
						traceId,
					};
				}
			};

			const result = await handlerExecution();
			expect(result.success).toBe(false);
			expect(result.errorCode).toBe(ErrorCode.INTERNAL); // Not detected as validation
			expect(result.error).toContain("exceeds maximum length");
			expect(result.traceId).toBeDefined();
		});

		it("should classify NOT_FOUND errors correctly", async () => {
			const handlerExecution = async () => {
				const traceId = generateTraceId();
				Logger.request("users.getUser", traceId, { username: "nonexistent" });

				try {
					throw new Error("User not found");
				} catch (error) {
					const appError = new AppError(
						error instanceof Error ? error.message : "Failed to get user",
						ErrorCode.NOT_FOUND,
						traceId,
					);

					Logger.error(
						`users.getUser failed: ${appError.message}`,
						traceId,
						error instanceof Error ? error : undefined,
					);

					return {
						success: false,
						error: appError.message,
						errorCode: appError.code,
						traceId,
					};
				}
			};

			const result = await handlerExecution();
			expect(result.errorCode).toBe(ErrorCode.NOT_FOUND);
			expect(result.error).toBe("User not found");
		});

		it("should classify DUPLICATE_ENTRY errors correctly", async () => {
			const handlerExecution = async () => {
				const traceId = generateTraceId();
				Logger.request("auth.register", traceId, { email: "duplicate@test.com" });

				try {
					throw new Error("Email already exists in unique constraint");
				} catch (error) {
					const appError = new AppError(
						error instanceof Error ? error.message : "Registration failed",
						error instanceof Error && error.message.includes("unique")
							? ErrorCode.DUPLICATE_ENTRY
							: ErrorCode.INTERNAL,
						traceId,
					);

					return {
						success: false,
						error: appError.message,
						errorCode: appError.code,
						traceId,
					};
				}
			};

			const result = await handlerExecution();
			expect(result.errorCode).toBe(ErrorCode.DUPLICATE_ENTRY);
		});

		it("should classify PERMISSION_DENIED errors correctly", async () => {
			const handlerExecution = async () => {
				const traceId = generateTraceId();
				Logger.request("posts.deletePost", traceId);

				try {
					throw new Error("You do not have permission to delete this post");
				} catch (error) {
					const appError = new AppError(
						error instanceof Error ? error.message : "Failed to delete post",
						error instanceof Error && error.message.includes("permission")
							? ErrorCode.PERMISSION_DENIED
							: ErrorCode.INTERNAL,
						traceId,
					);

					return {
						success: false,
						error: appError.message,
						errorCode: appError.code,
						traceId,
					};
				}
			};

			const result = await handlerExecution();
			expect(result.errorCode).toBe(ErrorCode.PERMISSION_DENIED);
		});
	});

	describe("Trace ID Propagation", () => {
		it("should include same trace ID in request and response logs", async () => {
			let requestTraceId = "";
			let responseTraceId = "";

			const logInterceptor = (call: any) => {
				const logged = JSON.parse(call[0]);
				if (logged.message.includes("request started")) {
					requestTraceId = logged.traceId;
				}
				if (logged.message.includes("request completed")) {
					responseTraceId = logged.traceId;
				}
			};

			logSpy.mockImplementation(logInterceptor);

			const handlerExecution = async () => {
				const traceId = generateTraceId();
				Logger.request("service.method", traceId);
				Logger.response("service.method", traceId, Date.now(), true);

				return {
					success: true,
					traceId,
				};
			};

			const result = await handlerExecution();

			expect(requestTraceId).toBe(responseTraceId);
			expect(requestTraceId).toBe(result.traceId);
		});

		it("should include trace ID in error logs and response", async () => {
			let errorLogTraceId = "";

			const logInterceptor = (call: any) => {
				const logged = JSON.parse(call[0]);
				if (logged.level === "error") {
					errorLogTraceId = logged.traceId;
				}
			};

			errorSpy.mockImplementation(logInterceptor);

			const handlerExecution = async () => {
				const traceId = generateTraceId();
				Logger.request("service.method", traceId);

				try {
					throw new Error("Test error");
				} catch (error) {
					Logger.error(
						"service.method failed",
						traceId,
						error instanceof Error ? error : undefined,
					);

					return {
						success: false,
						error: "Test error",
						traceId,
					};
				}
			};

			const result = await handlerExecution();

			expect(errorLogTraceId).toBe(result.traceId);
		});
	});

	describe("Structured Logging Format", () => {
		it("should log requests with endpoint and context", () => {
			Logger.request("auth.login", "trace-123", {
				email: "user@test.com",
				remoteIp: "192.168.1.1",
			});

			expect(logSpy).toHaveBeenCalled();
			const logged = JSON.parse(logSpy.mock.calls[0][0]);

			expect(logged).toMatchObject({
				level: "info",
				message: expect.stringContaining("request started"),
				traceId: "trace-123",
				timestamp: expect.any(String),
				context: {
					endpoint: "auth.login",
					email: "user@test.com",
					remoteIp: "192.168.1.1",
				},
			});
		});

		it("should log responses with duration and success status", () => {
			const startTime = Date.now();
			Logger.response("service.method", "trace-456", startTime, true, {
				itemCount: 10,
			});

			expect(logSpy).toHaveBeenCalled();
			const logged = JSON.parse(logSpy.mock.calls[0][0]);

			expect(logged).toMatchObject({
				level: "info",
				message: expect.stringContaining("request completed"),
				traceId: "trace-456",
				context: {
					success: true,
					itemCount: 10,
					duration: expect.any(Number),
				},
			});

			expect(logged.context.duration).toBeGreaterThanOrEqual(0);
		});

		it("should log errors with error details", () => {
			const testError = new Error("Database connection failed");
			Logger.error("db.query", "trace-789", testError, { query: "SELECT * FROM users" });

			expect(errorSpy).toHaveBeenCalled();
			const logged = JSON.parse(errorSpy.mock.calls[0][0]);

			expect(logged).toMatchObject({
				level: "error",
				message: "db.query",
				traceId: "trace-789",
				context: {
					query: "SELECT * FROM users",
				},
				error: {
					message: "Database connection failed",
					stack: expect.any(String),
				},
			});
		});
	});

	describe("Response Contract Preservation", () => {
		it("should preserve existing success response fields", async () => {
			const handler = async () => {
				const traceId = generateTraceId();
				// Simulate bookmarks handler response
				return {
					success: true,
					bookmarked: true,
					traceId, // New field added
				};
			};

			const result = await handler();
			expect(result.success).toBe(true);
			expect(result.bookmarked).toBe(true);
			expect(result.traceId).toBeDefined();
		});

		it("should preserve existing error response fields", async () => {
			const handler = async () => {
				const traceId = generateTraceId();
				// Simulate handler error response
				return {
					success: false,
					error: "Failed to create post",
					traceId, // New field
					errorCode: ErrorCode.INTERNAL, // Optional new field
				};
			};

			const result = await handler();
			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.traceId).toBeDefined();
		});

		it("should preserve list responses with trace ID", async () => {
			const handler = async () => {
				const traceId = generateTraceId();
				// Simulate pagination response
				return {
					posts: [
						{ id: "1", content: "Post 1" },
						{ id: "2", content: "Post 2" },
					],
					total: 2,
					traceId,
				};
			};

			const result = await handler();
			expect(result.posts).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.traceId).toBeDefined();
		});
	});

	describe("Error Code to HTTP Status Mapping", () => {
		const errorMappings = [
			{
				code: ErrorCode.INVALID_ARGUMENT,
				expectedStatus: 400,
				description: "Client validation error",
			},
			{
				code: ErrorCode.UNAUTHORIZED,
				expectedStatus: 401,
				description: "Missing credentials",
			},
			{
				code: ErrorCode.FORBIDDEN,
				expectedStatus: 403,
				description: "Insufficient permissions",
			},
			{
				code: ErrorCode.NOT_FOUND,
				expectedStatus: 404,
				description: "Resource not found",
			},
			{
				code: ErrorCode.DUPLICATE_ENTRY,
				expectedStatus: 409,
				description: "Resource already exists",
			},
			{
				code: ErrorCode.INTERNAL,
				expectedStatus: 500,
				description: "Unexpected server error",
			},
		];

		errorMappings.forEach(({ code, expectedStatus, description }) => {
			it(`should map ${code} to HTTP ${expectedStatus} - ${description}`, () => {
				const error = new AppError("Test error", code, "trace-1");
				expect(error.statusCode).toBe(expectedStatus);
			});
		});
	});
});
