import crypto from "crypto";

export interface WebhookVerifyOptions {
  /** Raw request body as a Buffer or string (must NOT be parsed first). */
  body: Buffer | string;
  /** Signature header value sent by the provider (e.g. "sha256=abc123…"). */
  signature: string;
  /** Shared secret key issued by the provider. */
  secret: string;
  /**
   * Unix timestamp (seconds) embedded in the request header by the provider.
   * Used to enforce the freshness window.  Pass `undefined` to skip the check.
   */
  timestamp?: number;
  /**
   * Maximum age of the request in seconds (default: 300 — 5 minutes).
   * Requests older than this window are rejected to prevent replay attacks.
   */
  toleranceSeconds?: number;
  /** Optional provider label used in error messages (e.g. "wolt", "10bis"). */
  provider?: string;
}

export interface WebhookVerifyResult {
  valid: boolean;
  /** Human-readable rejection reason (only set when `valid` is false). */
  reason?: string;
}

/**
 * Verifies an inbound webhook request using HMAC-SHA256.
 *
 * Security properties:
 * - Constant-time comparison (`crypto.timingSafeEqual`) prevents timing oracle attacks.
 * - Timestamp freshness check eliminates replay attacks within 5 minutes.
 * - Both raw Buffer and string bodies are supported to avoid double-parsing issues.
 *
 * @example
 * ```ts
 * const result = verifyWebhookSignature({
 *   body: rawBodyBuffer,
 *   signature: req.headers["x-wolt-signature"] as string,
 *   secret: process.env.WOLT_WEBHOOK_SECRET!,
 *   timestamp: Number(req.headers["x-wolt-timestamp"]),
 * });
 * if (!result.valid) throw new Error(`Webhook rejected: ${result.reason}`);
 * ```
 */
export function verifyWebhookSignature(options: WebhookVerifyOptions): WebhookVerifyResult {
  const {
    body,
    signature,
    secret,
    timestamp,
    toleranceSeconds = 300,
    provider = "webhook",
  } = options;

  // ── 1. Timestamp freshness check ──────────────────────────────────────────
  if (timestamp !== undefined) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const age = Math.abs(nowSeconds - timestamp);
    if (age > toleranceSeconds) {
      return {
        valid: false,
        reason: `${provider}: Request timestamp is stale (age=${age}s, tolerance=${toleranceSeconds}s). Possible replay attack.`,
      };
    }
  }

  // ── 2. Compute expected signature ────────────────────────────────────────
  const rawBody = typeof body === "string" ? Buffer.from(body, "utf8") : body;

  // Some providers prefix the signature (e.g. "sha256=<hex>"). Strip the prefix.
  const rawSig = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  let expectedBuf: Buffer;
  try {
    expectedBuf = Buffer.from(
      crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
      "utf8"
    );
  } catch {
    return { valid: false, reason: `${provider}: Failed to compute HMAC.` };
  }

  // ── 3. Constant-time comparison ──────────────────────────────────────────
  let receivedBuf: Buffer;
  try {
    receivedBuf = Buffer.from(rawSig, "utf8");
  } catch {
    return { valid: false, reason: `${provider}: Malformed signature encoding.` };
  }

  // Buffers must be the same length for timingSafeEqual
  if (expectedBuf.length !== receivedBuf.length) {
    return { valid: false, reason: `${provider}: Signature length mismatch.` };
  }

  const signaturesMatch = crypto.timingSafeEqual(expectedBuf, receivedBuf);
  if (!signaturesMatch) {
    return { valid: false, reason: `${provider}: HMAC signature mismatch.` };
  }

  return { valid: true };
}
