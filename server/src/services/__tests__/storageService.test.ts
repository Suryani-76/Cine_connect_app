import { describe, it, expect } from "vitest"
import {
  validateAvatarUpload,
  validateResumeUpload,
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
  MAX_RESUME_SIZE_BYTES,
} from "../storageService"

describe("storageService - Upload Hardening & Validation", () => {
  describe("validateAvatarUpload", () => {
    it("accepts valid JPEG, PNG, and WebP under 2 MB", () => {
      for (const mime of ALLOWED_AVATAR_MIME_TYPES) {
        const result = validateAvatarUpload({
          mimetype: mime,
          size: 1 * 1024 * 1024, // 1 MB
          originalname: `photo.${mime.split("/")[1]}`,
        })
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }
    })

    it("strictly blocks SVG uploads to prevent stored XSS", () => {
      const svgMimeResult = validateAvatarUpload({
        mimetype: "image/svg+xml",
        size: 500,
        originalname: "avatar.svg",
      })
      expect(svgMimeResult.valid).toBe(false)
      expect(svgMimeResult.error).toContain("SVG uploads are strictly disallowed")

      const svgExtResult = validateAvatarUpload({
        mimetype: "image/jpeg",
        size: 500,
        originalname: "malicious_payload.SVG",
      })
      expect(svgExtResult.valid).toBe(false)
      expect(svgExtResult.error).toContain("SVG uploads are strictly disallowed")
    })

    it("rejects files exceeding 2 MB", () => {
      const result = validateAvatarUpload({
        mimetype: "image/png",
        size: MAX_AVATAR_SIZE_BYTES + 1,
        originalname: "huge.png",
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain("exceeds the 2 MB limit")
    })

    it("rejects disallowed MIME types (e.g. text/html, application/javascript, image/gif)", () => {
      const gifResult = validateAvatarUpload({
        mimetype: "image/gif",
        size: 5000,
        originalname: "animation.gif",
      })
      expect(gifResult.valid).toBe(false)
      expect(gifResult.error).toContain("Unsupported file type")
    })
  })

  describe("validateResumeUpload", () => {
    it("accepts valid PDF under 5 MB", () => {
      const result = validateResumeUpload({
        mimetype: "application/pdf",
        size: 2 * 1024 * 1024, // 2 MB
        originalname: "resume.pdf",
      })
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it("rejects non-PDF files (e.g. docx, txt)", () => {
      const result = validateResumeUpload({
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1000,
        originalname: "resume.docx",
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain("Resumes must be PDF format")
    })

    it("rejects PDFs exceeding 5 MB", () => {
      const result = validateResumeUpload({
        mimetype: "application/pdf",
        size: MAX_RESUME_SIZE_BYTES + 10,
        originalname: "large_portfolio_resume.pdf",
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain("exceeds the 5 MB limit")
    })
  })
})
