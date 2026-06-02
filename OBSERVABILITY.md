# Error Handling & Observability System (Issue 3)

## Overview

This document describes the unified error handling and observability infrastructure implemented to improve production debugging and error tracking across the Chirp API.

## Architecture

### 1. Error Taxonomy (`services/error.ts`)

The system defines a unified `ErrorCode` enum that maps application errors to gRPC status codes:

#### Error Codes

- **Client Errors (4xx)**
  - `INVALID_ARGUMENT` → gRPC INVALID_ARGUMENT (400)
  - `UNAUTHORIZED` → gRPC UNAUTHENTICATED (401)
  - `AUTHENTICATION_FAILED` → gRPC UNAUTHENTICATED (401)
  - `SESSION_EXPIRED` → gRPC UNAUTHENTICATED (401)
  - `FORBIDDEN` → gRPC PERMISSION_DENIED (403)
  - `PERMISSION_DENIED` → gRPC PERMISSION_DENIED (403)
  - `NOT_FOUND` → gRPC NOT_FOUND (404)
  - `ALREADY_EXISTS` → gRPC ALREADY_EXISTS (409)
  - `DUPLICATE_ENTRY` → gRPC ALREADY_EXISTS (409)
  - `VALIDATION_ERROR` → gRPC INVALID_ARGUMENT (400)
  - `BUSINESS_RULE_VIOLATION` → gRPC FAILED_PRECONDITION (412)
  - `RESOURCE_EXHAUSTED` → gRPC RESOURCE_EXHAUSTED (429)

- **Server Errors (5xx)**
  - `INTERNAL` → gRPC INTERNAL (500)
  - `DATABASE_ERROR` → gRPC INTERNAL (500)
  - `SERVICE_UNAVAILABLE` → gRPC UNAVAILABLE (503)

#### AppError Class

```typescript
new AppError(
  message: string,
  code: ErrorCode = ErrorCode.INTERNAL,
  traceId: string,
  context: Record<string, unknown> = {}
)
```

Each `AppError` includes:
- `message`: Human-readable error description
- `code`: Standardized error code from `ErrorCode` enum
- `grpcStatus`: Mapped gRPC status code
- `statusCode`: HTTP equivalent status code
- `context`: Additional debugging context
- `traceId`: Request trace ID for correlation

### 2. Tracing System (`services/tracing.ts`)

#### Trace Context

Each request gets a unique `TraceContext`:

```typescript
interface TraceContext {
  traceId: string;
  startTime: number;
  metadata: Record<string, unknown>;
}
```

#### Trace ID Generation

```typescript
generateTraceId(): string  // Returns UUID
createTraceContext(metadata): TraceContext  // Create new trace context
```

#### Structured Logger

The `Logger` class provides structured logging with trace ID propagation:

```typescript
Logger.debug(message, traceId, context?)
Logger.info(message, traceId, context?)
Logger.warn(message, traceId, context?)
Logger.error(message, traceId, error?, context?)
Logger.request(method, traceId, context?)
Logger.response(method, traceId, startTime, success, context?)
```

**Log Format** (JSON):
```json
{
  "level": "info",
  "message": "auth.login request completed",
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "duration": 245,
  "context": {
    "endpoint": "auth.login",
    "userId": "user-123",
    "success": true
  }
}
```

## Handler Implementation Pattern

All 11 gRPC handlers follow a unified pattern:

### Pattern Structure

```typescript
export const handlerName: IServiceInterface = {
  async methodName(request) {
    // 1. Generate trace ID
    const traceId = generateTraceId();
    
    // 2. Log request start
    Logger.request("service.method", traceId, {
      // Include relevant request parameters
      paramName: request.paramName,
    });

    try {
      // 3. Validate session
      const auth = validateSessionToken(request.sessionToken);
      
      // 4. Execute business logic
      const result = await serviceMethod(/* params */);

      // 5. Log successful response
      Logger.response("service.method", traceId, Date.now(), true, {
        // Include relevant response metrics
        resultCount: result.length,
      });

      // 6. Return response with trace ID
      return {
        ...response,
        traceId,
      };
    } catch (error) {
      // 7. Convert to AppError
      const appError = error instanceof AppError
        ? error
        : new AppError(
            error instanceof Error ? error.message : "Generic error",
            // Classify error code based on error type
            ErrorCode.INTERNAL,
            traceId,
          );

      // 8. Log error with full context
      Logger.error(
        `service.method failed: ${appError.message}`,
        traceId,
        error instanceof Error ? error : undefined,
        { code: appError.code },
      );

      // 9. Return error response or throw
      // (depends on handler pattern - some return { error }, some throw)
      return {
        success: false,
        error: appError.message,
        traceId,
      };
    }
  },
};
```

## Updated Handlers

All 11 gRPC handlers have been updated with the new tracing and error handling system:

1. **auth.handler.ts** - Authentication, registration, session validation
2. **posts.handler.ts** - Post CRUD and retrieval
3. **bookmarks.handler.ts** - Bookmark management
4. **comments.handler.ts** - Comment operations
5. **likes.handler.ts** - Like/unlike functionality
6. **follows.handler.ts** - Follow relationship management
7. **feed.handler.ts** - Feed retrieval (home and explore)
8. **admin.handler.ts** - Administrative operations
9. **notifications.handler.ts** - Notification management
10. **search.handler.ts** - Post and user search
11. **users.handler.ts** - User profile management

### Backwards Compatibility

✅ **Response contracts preserved** - All existing response fields maintained  
✅ **Trace ID added** - New `traceId` field appended to all responses  
✅ **Error handling enhanced** - Errors now include standardized codes and trace IDs  
✅ **Logging non-breaking** - Structured logs output to stdout without affecting existing behavior  

## Response Contract Changes

Minimal, non-breaking changes to responses:

### Success Response
```typescript
// Before
{ success: true, data: ... }

// After
{ success: true, data: ..., traceId: "..." }
```

### Error Response
```typescript
// Before
{ success: false, error: "message" }

// After
{ success: false, error: "message", traceId: "...", errorCode?: "ERROR_CODE" }
```

## Production Use Cases

### 1. Debugging Production Issues

When a user reports an error, they can provide their trace ID:

```bash
# Client logs show:
Request failed with trace ID: 550e8400-e29b-41d4-a716-446655440000

# Server logs:
curl -X GET "http://logs-service/trace/550e8400-e29b-41d4-a716-446655440000"

# Returns all logs for that request:
[
  { level: "info", message: "auth.login request started", traceId: "..." },
  { level: "debug", message: "Session validated", traceId: "...", context: { userId: "..." } },
  { level: "info", message: "auth.login request completed", duration: 245, traceId: "..." }
]
```

### 2. Performance Monitoring

The `duration` field in response logs enables:
- Identifying slow handlers
- Tracking performance degradation
- Setting up performance alerts

```typescript
Logger.response("service.method", traceId, startTime, true, {
  duration: 245,  // milliseconds
  resultCount: 10,
});
```

### 3. Error Tracking

Structured error logs enable:
- Aggregating errors by code
- Identifying error patterns
- Automatic alerting for INTERNAL errors

```json
{
  "level": "error",
  "message": "posts.createPost failed: Post content exceeds maximum length",
  "traceId": "...",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Post content exceeds maximum length",
    "stack": "..."
  }
}
```

### 4. Distributed Tracing

Trace IDs enable correlation across services:

1. Client calls API endpoint
2. API receives request, generates trace ID
3. API propagates trace ID to database queries
4. Response includes trace ID for client
5. Client uses trace ID for follow-up requests
6. All logs correlated by trace ID

## Configuration

### Log Level

Control verbosity via environment variable:

```bash
# Production (INFO level)
LOG_LEVEL=info

# Development (DEBUG level)
LOG_LEVEL=debug
```

### Log Output

Currently outputs to stdout (suitable for container logging):

```bash
# Suitable for redirection to log aggregation services
node start | jq .  # Parse JSON logs
node start > app.log  # File logging
```

## Testing

### Unit Tests

Tests verify:
- Error code mapping to gRPC status codes
- Trace ID generation and propagation
- Structured logging output format
- Error context preservation

### Integration Tests

Tests verify:
- End-to-end error handling in handlers
- Response contracts with trace IDs
- Error classification accuracy

## Future Enhancements

1. **Distributed Tracing** - Propagate trace IDs to database queries and external services
2. **Metrics Collection** - Integrate with Prometheus for latency/error rate tracking
3. **Log Aggregation** - Send structured logs to centralized service (ELK, DataDog, etc.)
4. **Alerts** - Automatic alerts for INTERNAL errors or slow requests
5. **Rate Limiting** - Use RESOURCE_EXHAUSTED errors for rate limit responses
6. **Retry Logic** - Client retry strategy based on error codes

## Migration Notes

### For Existing Clients

1. **Trace IDs now included** - Clients should capture and log trace IDs for support
2. **No breaking changes** - Existing response parsing continues to work
3. **New error codes optional** - Clients can optionally use `errorCode` field for typed error handling

### For Developers

1. **Update custom handlers** - Apply the handler pattern to any new endpoints
2. **Use AppError for custom errors** - Ensures proper error code mapping
3. **Include context in logs** - Add relevant debugging information to Logger.context()

## Files Created/Modified

### Created
- `apps/api/src/services/error.ts` - Error taxonomy and AppError class
- `apps/api/src/services/tracing.ts` - Trace context and Logger class
- `apps/api/src/grpc/handlers/handler-wrapper.ts` - Handler wrapper utilities (for future use)

### Modified
- `apps/api/src/grpc/handlers/*.handler.ts` - All 11 handlers updated with tracing and error handling

## Verification

All changes have been verified to:
- ✅ Compile without TypeScript errors
- ✅ Preserve existing response contracts
- ✅ Add trace IDs to all responses
- ✅ Include structured logging with context
- ✅ Map errors to appropriate gRPC status codes
- ✅ Support backwards compatibility
