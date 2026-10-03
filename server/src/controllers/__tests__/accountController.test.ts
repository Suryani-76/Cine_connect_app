import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express from "express"
import { accountRouter } from "../../routes/account"
import { errorHandler } from "../../middleware/errorHandler"
import * as accountService from "../../services/accountService"

// Mock caller context
let mockCaller: { userId: string; role: "production" | "talent"; profileId: string } | null = {
  userId: "user-123-uuid",
  role: "talent",
  profileId: "profile-123-uuid",
}

vi.mock("../../middleware/authMiddleware", () => ({
  requireAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}))

vi.mock("../../middleware/callerContext", () => ({
  loadCallerContext: vi.fn((req: { caller?: unknown }, _res: unknown, next: () => void) => {
    req.caller = mockCaller
    next()
  }),
}))

vi.mock("../../services/accountService", () => ({
  exportUserData: vi.fn(),
  deleteUserAccount: vi.fn(),
}))

const app = express()
app.use(express.json())
app.use("/account", accountRouter)
app.use(errorHandler)

describe("Account Controller & Data Rights (DPDP Act 2023 / GDPR)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCaller = {
      userId: "user-123-uuid",
      role: "talent",
      profileId: "profile-123-uuid",
    }
  })

  describe("GET /account/export", () => {
    it("returns 200 with formatted data export for authenticated user", async () => {
      const mockExportData = {
        exported_at: "2026-10-02T12:00:00.000Z",
        jurisdiction_notice: "DPDP Act 2023 & GDPR Art. 20 Compliant",
        user: { id: "user-123-uuid", email: "talent@example.com", username: "talentpro", role: "talent", created_at: "2026-01-01" },
        consents: [{ version: "1.0", terms_accepted: true, privacy_accepted: true, consented_at: "2026-01-01" }],
        profile: { full_name: "Test Talent", skills: ["Cinematography"] },
        applications: [],
        jobs: [],
        alerts: [],
        saved_jobs: [],
        messages: [],
        notifications: [],
      }

      vi.mocked(accountService.exportUserData).mockResolvedValueOnce(mockExportData as any)

      const res = await request(app).get("/account/export")

      expect(res.status).toBe(200)
      expect(res.headers["content-disposition"]).toContain("cineconnect-data-export-")
      expect(res.body.user.id).toBe("user-123-uuid")
      expect(res.body.consents).toHaveLength(1)
      expect(accountService.exportUserData).toHaveBeenCalledWith("user-123-uuid")
    })

    it("returns 401 if caller identity is missing", async () => {
      mockCaller = null
      const res = await request(app).get("/account/export")
      expect(res.status).toBe(401)
      expect(res.body.error).toBe("Unauthorized")
    })
  })

  describe("DELETE /account", () => {
    it("returns 200 and purges user account and storage objects", async () => {
      vi.mocked(accountService.deleteUserAccount).mockResolvedValueOnce(undefined)

      const res = await request(app).delete("/account")

      expect(res.status).toBe(200)
      expect(res.body.message).toContain("permanently deleted")
      expect(accountService.deleteUserAccount).toHaveBeenCalledWith("user-123-uuid")
    })

    it("returns 401 if caller identity is missing on deletion", async () => {
      mockCaller = null
      const res = await request(app).delete("/account")
      expect(res.status).toBe(401)
      expect(res.body.error).toBe("Unauthorized")
    })
  })
})
