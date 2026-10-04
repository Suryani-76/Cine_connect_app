/**
 * storageService.ts
 * ─────────────────
 * Enforces strict MIME type, file size, extension, and magic bytes security checks
 * on files before storage upload. Specifically mitigates stored XSS by blocking
 * SVG uploads and restricting avatars to 2 MB, resumes to 5 MB PDF only.
 *
 * Sniffs binary magic bytes directly from buffer to prevent header spoofing.
 */

import { supabase } from '../db/supabase'

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
 * Sniffs binary file magic bytes to verify actual content type.
 */
export function sniffMagicBytes(
  buffer: Buffer
): 'jpeg' | 'png' | 'webp' | 'pdf' | 'svg' | 'unknown' {
  if (!buffer || buffer.length < 4) return 'unknown'

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg'
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png'
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }

  // PDF: %PDF (bytes 0-3)
  if (buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'pdf'
  }

  // SVG sniffing: check first 512 bytes for XML/SVG indicators
  const snippet = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').toLowerCase()
  if (
    snippet.includes('<svg') ||
    snippet.includes('<?xml') ||
    snippet.includes('xmlns="http://www.w3.org/2000/svg"')
  ) {
    return 'svg'
  }

  return 'unknown'
}

/**
 * Validates avatar image uploads:
 * - Must be JPEG, PNG, or WebP.
 * - Under 2 MB.
 * - Rejects SVGs to prevent stored Cross-Site Scripting (XSS).
 * - Sniffs magic bytes if buffer is present.
 */
export function validateAvatarUpload(file: {
  mimetype: string
  size: number
  buffer?: Buffer
  originalname?: string
}): StorageValidationResult {
  const { mimetype, size, buffer, originalname } = file

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

  if (
    !ALLOWED_AVATAR_MIME_TYPES.includes(
      mimetype as (typeof ALLOWED_AVATAR_MIME_TYPES)[number]
    )
  ) {
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

  // If buffer is available, sniff actual magic bytes
  if (buffer) {
    const magic = sniffMagicBytes(buffer)
    if (magic === 'svg') {
      return {
        valid: false,
        error: "SVG uploads are strictly disallowed for security reasons. Please upload a JPG, PNG, or WebP image.",
      }
    }
    if (magic !== 'jpeg' && magic !== 'png' && magic !== 'webp') {
      return {
        valid: false,
        error: "File content does not match allowed image formats (magic bytes mismatch).",
      }
    }
  }

  return { valid: true }
}

/**
 * Validates resume document uploads:
 * - Must be PDF.
 * - Under 5 MB.
 * - Sniffs %PDF magic bytes if buffer is present.
 * - Resumes are stored in a private bucket.
 */
export function validateResumeUpload(file: {
  mimetype: string
  size: number
  buffer?: Buffer
  originalname?: string
}): StorageValidationResult {
  const { mimetype, size, buffer } = file

  if (
    !ALLOWED_RESUME_MIME_TYPES.includes(
      mimetype as (typeof ALLOWED_RESUME_MIME_TYPES)[number]
    )
  ) {
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

  // If buffer is available, verify %PDF magic bytes
  if (buffer) {
    const magic = sniffMagicBytes(buffer)
    if (magic !== 'pdf') {
      return {
        valid: false,
        error: "File content is not a valid PDF document (magic bytes mismatch).",
      }
    }
  }

  return { valid: true }
}

// ── Showreel URL Validation ───────────────────────────────────

export const ALLOWED_SHOWREEL_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
] as const

/**
 * Validates that a showreel URL is strictly a YouTube or Vimeo URL.
 * Prevents arbitrary iframe injection (matches CSP frame-src).
 */
export function isValidShowreelUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false
  try {
    const parsed = new URL(urlString.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    return ALLOWED_SHOWREEL_HOSTS.includes(host as (typeof ALLOWED_SHOWREEL_HOSTS)[number])
  } catch {
    return false
  }
}

/**
 * Converts a valid YouTube or Vimeo watch/share URL into a sandboxed embed URL.
 * Returns null if the URL is not from an approved host.
 */
export function getShowreelEmbedUrl(urlString: string): string | null {
  if (!isValidShowreelUrl(urlString)) return null

  try {
    const parsed = new URL(urlString.trim())
    const host = parsed.hostname.toLowerCase()

    // 1. YouTube Short URL (youtu.be/ID)
    if (host === 'youtu.be') {
      const videoId = parsed.pathname.slice(1).split('/')[0]
      return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
    }

    // 2. YouTube Standard URL (youtube.com/watch?v=ID or /embed/ID)
    if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'www.youtube-nocookie.com'
    ) {
      if (parsed.pathname.startsWith('/embed/')) {
        const videoId = parsed.pathname.split('/')[2]
        return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
      }
      const videoId = parsed.searchParams.get('v')
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${videoId}`
      }
      return null
    }

    // 3. Vimeo URL (vimeo.com/ID or player.vimeo.com/video/ID)
    if (host === 'vimeo.com' || host === 'www.vimeo.com') {
      const match = parsed.pathname.match(/^\/(\d+)/)
      const videoId = match ? match[1] : null
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null
    }

    if (host === 'player.vimeo.com') {
      const match = parsed.pathname.match(/\/video\/(\d+)/)
      const videoId = match ? match[1] : null
      return videoId ? `https://player.vimeo.com/video/${videoId}` : null
    }

    return null
  } catch {
    return null
  }
}

// ── Storage Operations ────────────────────────────────────────

/**
 * Uploads avatar image buffer to the public 'avatars' bucket.
 * Returns public URL and storage path.
 */
export async function uploadAvatarToStorage(
  userId: string,
  buffer: Buffer,
  mimetype: string
): Promise<{ publicUrl: string; path: string }> {
  const ext = mimetype === 'image/jpeg' ? 'jpg' : mimetype === 'image/png' ? 'png' : 'webp'
  const path = `${userId}/avatar-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('avatars').upload(path, buffer, {
    contentType: mimetype,
    upsert: true,
  })

  if (error) {
    throw Object.assign(new Error(`Failed to upload avatar: ${error.message}`), { statusCode: 500 })
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return { publicUrl: data.publicUrl, path }
}

/**
 * Uploads resume PDF buffer to the private 'resumes' bucket.
 * Returns storage path.
 */
export async function uploadResumeToStorage(
  userId: string,
  buffer: Buffer
): Promise<{ path: string }> {
  const path = `${userId}/resume-${Date.now()}.pdf`

  const { error } = await supabase.storage.from('resumes').upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  })

  if (error) {
    throw Object.assign(new Error(`Failed to upload resume: ${error.message}`), { statusCode: 500 })
  }

  return { path }
}

/**
 * Deletes a resume file from the private 'resumes' bucket.
 */
export async function deleteResumeFromStorage(path: string): Promise<void> {
  const { error } = await supabase.storage.from('resumes').remove([path])
  if (error) {
    console.warn(`[storageService] Failed to remove resume file ${path}:`, error.message)
  }
}

/**
 * Creates a signed URL for a private resume with 60s expiration.
 */
export async function createSignedResumeUrl(path: string, expiresIn = 60): Promise<string> {
  const { data, error } = await supabase.storage.from('resumes').createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) {
    throw Object.assign(new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`), {
      statusCode: 500,
    })
  }
  return data.signedUrl
}

