# Security Summary

## Credential Storage Vulnerability

The previous authentication stack used a legacy credential storage pattern that relied on a SHA-256 hash with a static salt.
This is insufficient for password storage because:
- SHA-256 is fast and designed for general hashing, not password hashing.
- A constant salt makes the hash vulnerable to rainbow-table and offline brute-force attacks.
- A single compromised database would expose all password hashes to efficient cracking.

Severity: High.

### Fix
- Upgraded password hashing to `scrypt` with a per-user random salt and strong cost parameters.
- Implemented a backwards-compatible migration path: legacy SHA-256 hashes are still accepted on login, but the account is transparently rehashed to the modern `scrypt` scheme immediately after a successful login.
- No plaintext passwords are stored in the database or logs.

## Client/API Trust Establishment Vulnerability

The gRPC stack previously allowed insecure transport by default and relied on a shared fallback JWT secret in code.
This means a client could connect over an untrusted channel or a token could be forged if the default secret was reused.

Severity: High.

### Fix
- Production gRPC servers now require TLS certificate configuration via `GRPC_TLS_KEY_FILE` and `GRPC_TLS_CERT_FILE`.
- Clients default to secure transport in production and can still use insecure channels only in development.
- Production requires `GRPC_JWT_SECRET`; it is no longer silently replaced with a hard-coded fallback.
