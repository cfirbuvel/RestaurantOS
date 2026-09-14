import path from "path";

// ─── Magic Number Signatures ─────────────────────────────────────────────────

/** Known magic byte patterns for allowed file types. */
const MAGIC_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  // JPEG: FF D8 FF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  // GIF: 47 49 46 38
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  // WebP: RIFF????WEBP (bytes 0-3 are RIFF, bytes 8-11 are WEBP)
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  // PDF: %PDF
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  // HEIC/HEIF (common subset): ftyp at offset 4
  { mime: "image/heic", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

// ─── Allowlists ───────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".pdf",
]);

// ─── Limits ───────────────────────────────────────────────────────────────────

/** Default maximum upload size: 10 MB */
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileValidationInput {
  /** Raw file content as a Buffer. */
  buffer: Buffer;
  /** Original filename as provided by the client. */
  filename: string;
  /** MIME type declared by the client (used as supplementary check only). */
  declaredMimeType?: string;
  /** Override the default 10 MB size limit. */
  maxSizeBytes?: number;
}

export interface FileValidationResult {
  valid: boolean;
  /** Rejection reason (only present when `valid` is false). */
  reason?: string;
  /** Detected MIME type from magic number inspection. */
  detectedMimeType?: string;
  /** Sanitized filename safe to persist (no path components, no null bytes). */
  sanitizedFilename?: string;
}

// ─── Core Validator ───────────────────────────────────────────────────────────

/**
 * Validates an uploaded file by:
 * 1. Checking file size against the configured limit.
 * 2. Inspecting magic-number bytes to detect the true content type.
 * 3. Enforcing an extension allowlist on the sanitized filename.
 * 4. Sanitizing the filename to remove path traversal sequences and null bytes.
 *
 * @example
 * ```ts
 * const result = validateFileUpload({
 *   buffer: fileBuffer,
 *   filename: req.file.originalname,
 *   declaredMimeType: req.file.mimetype,
 * });
 * if (!result.valid) return res.status(400).json({ error: result.reason });
 * ```
 */
export function validateFileUpload(input: FileValidationInput): FileValidationResult {
  const { buffer, filename, maxSizeBytes = DEFAULT_MAX_SIZE_BYTES } = input;

  // ── 1. Size check ──────────────────────────────────────────────────────────
  if (buffer.length > maxSizeBytes) {
    return {
      valid: false,
      reason: `File exceeds the maximum allowed size of ${maxSizeBytes / 1024 / 1024} MB.`,
    };
  }

  // ── 2. Filename sanitization ──────────────────────────────────────────────
  // Strip null bytes, then take only the basename to defeat path traversal
  const sanitized = path
    .basename(filename.replace(/\0/g, ""))
    .replace(/[<>:"/\\|?*]/g, "_"); // also neutralise shell-special characters

  if (!sanitized || sanitized === "." || sanitized === "..") {
    return { valid: false, reason: "Filename is invalid or empty after sanitization." };
  }

  // ── 3. Extension allowlist ────────────────────────────────────────────────
  const ext = path.extname(sanitized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      reason: `File extension "${ext}" is not permitted. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}.`,
    };
  }

  // ── 4. Magic number inspection ────────────────────────────────────────────
  const detectedMime = detectMimeFromBuffer(buffer);
  if (!detectedMime) {
    return {
      valid: false,
      reason: "Unable to identify file type from content. Upload rejected.",
    };
  }

  if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
    return {
      valid: false,
      reason: `Detected file type "${detectedMime}" is not permitted.`,
      detectedMimeType: detectedMime,
    };
  }

  // ── 5. Optional: declared MIME cross-check ────────────────────────────────
  if (input.declaredMimeType && input.declaredMimeType !== detectedMime) {
    // Log the mismatch but don't reject — the detected type is authoritative.
    console.warn(
      `[FileValidator] MIME mismatch: declared="${input.declaredMimeType}", detected="${detectedMime}", file="${sanitized}"`
    );
  }

  return {
    valid: true,
    detectedMimeType: detectedMime,
    sanitizedFilename: sanitized,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectMimeFromBuffer(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    const matches = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (matches) return sig.mime;
  }
  return null;
}
