/**
 * storageService.ts
 * ─────────────────
 * Enforces strict MIME type, file size, and extension security checks
 * on files before storage upload. Specifically mitigates stored XSS
 * by blocking SVG uploads and restricting avatars to 2 MB.
 */

export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

export const ALLOWED_RESUME_MIME_TYPES = [
  "application/pdf",
] as const

export const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export interface StorageValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates avatar image uploads:
 * - Must be JPEG, PNG, or WebP.
 * - Under 2 MB.
 * - Rejects SVGs to prevent stored Cross-Site Scripting (XSS).
 */
export function validateAvatarUpload(file: {
  mimetype: string
  size: number
  originalname?: string
}): StorageValidationResult {
  const { mimetype, size, originalname } = file

  // Explicit SVG check (MIME or file extension)
  if (
    mimetype === "image/svg+xml" ||
    (originalname && originalname.toLowerCase().endsWith(".svg"))
  ) {
    return {
      valid: false,
      error: "SVG uploads are strictly disallowed for security reasons. Please upload a JPG, PNG, or WebP image.",
    }
  }

  if (!ALLOWED_AVATAR_MIME_TYPES.includes(mimetype as (typeof ALLOWED_AVATAR_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimetype}. Allowed types are: ${ALLOWED_AVATAR_MIME_TYPES.join(", ")}`,
    }
  }

  if (size > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 2 MB limit (size: ${(size / 1024 / 1024).toFixed(2)} MB).`,
    }
  }

  return { valid: true }
}

/**
 * Validates resume document uploads:
 * - Must be PDF.
 * - Under 5 MB.
 * - Resumes are stored in a private bucket.
 */
export function validateResumeUpload(file: {
  mimetype: string
  size: number
  originalname?: string
}): StorageValidationResult {
  const { mimetype, size } = file

  if (!ALLOWED_RESUME_MIME_TYPES.includes(mimetype as (typeof ALLOWED_RESUME_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: `Unsupported resume file type: ${mimetype}. Resumes must be PDF format.`,
    }
  }

  if (size > MAX_RESUME_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 5 MB limit (size: ${(size / 1024 / 1024).toFixed(2)} MB).`,
    }
  }

  return { valid: true }
}
