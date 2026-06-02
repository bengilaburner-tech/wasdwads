import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGrpcServerCredentials } from "./server";

describe("gRPC server credential establishment", () => {
	const cleanupPaths: string[] = [];

	beforeEach(() => {
		delete process.env.NODE_ENV;
		delete process.env.GRPC_TLS_KEY_FILE;
		delete process.env.GRPC_TLS_CERT_FILE;
	});

	afterEach(() => {
		for (const path of cleanupPaths) {
			try {
				rmSync(path);
			} catch {
				// Ignore cleanup failures
			}
		}
		cleanupPaths.length = 0;
	});

	it("throws when running in production without TLS certificates", () => {
		process.env.NODE_ENV = "production";

		expect(() => createGrpcServerCredentials()).toThrow(
			"Production gRPC server requires GRPC_TLS_KEY_FILE and GRPC_TLS_CERT_FILE",
		);
	});

	it("creates secure credentials when TLS certificate files are configured", () => {
		process.env.NODE_ENV = "production";
		const keyPath = join(tmpdir(), `chirp-test-key-${Date.now()}.pem`);
		const certPath = join(tmpdir(), `chirp-test-cert-${Date.now()}.pem`);
		writeFileSync(keyPath, "dummy-key");
		writeFileSync(certPath, "dummy-cert");
		cleanupPaths.push(keyPath, certPath);

		process.env.GRPC_TLS_KEY_FILE = keyPath;
		process.env.GRPC_TLS_CERT_FILE = certPath;

		const credentials = createGrpcServerCredentials();
		expect(credentials).toBeDefined();
	});
});
