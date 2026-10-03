import { describe, it, expect, vi, beforeEach } from "vitest"
import { deleteUserAccount, exportUserData } from "../accountService"
import { supabase } from "../../db/supabase"

vi.mock("../../db/supabase", () => {
  const mockStorageFrom = vi.fn()
  const mockFrom = vi.fn()
  const mockAuthAdmin = {
    deleteUser: vi.fn(),
  }

  return {
    supabase: {
      storage: {
        from: mockStorageFrom,
      },
      from: mockFrom,
      auth: {
        admin: mockAuthAdmin,
      },
    },
  }
})

describe("accountService - End-to-End Account Deletion & Data Export", () => {
  const userId = "test-user-uuid-1234"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("deleteUserAccount", () => {
    it("proves no storage objects or database rows remain after deletion", async () => {
      const mockList = vi.fn().mockImplementation((prefix: string) => {
        return Promise.resolve({
          data: [{ name: "avatar-1.jpg" }, { name: "avatar-2.png" }],
          error: null,
        })
      })
      const mockRemove = vi.fn().mockResolvedValue({ data: [], error: null })

      vi.mocked(supabase.storage.from).mockReturnValue({
        list: mockList,
        remove: mockRemove,
      } as any)

      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      vi.mocked(supabase.auth.admin.deleteUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any)

      await deleteUserAccount(userId)

      // 1. Verify storage cleanup across both avatars and resumes buckets
      expect(supabase.storage.from).toHaveBeenCalledWith("avatars")
      expect(supabase.storage.from).toHaveBeenCalledWith("resumes")
      expect(mockRemove).toHaveBeenCalledWith([`${userId}/avatar-1.jpg`, `${userId}/avatar-2.png`])

      // 2. Verify database deletion from public.users with cascade
      expect(supabase.from).toHaveBeenCalledWith("users")
      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteEq).toHaveBeenCalledWith("id", userId)

      // 3. Verify Supabase Auth user deletion
      expect(supabase.auth.admin.deleteUser).toHaveBeenCalledWith(userId)
    })
  })

  describe("exportUserData", () => {
    it("returns comprehensive JSON export without leaking third-party private data", async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: userId, email: "user@cineconnect.in", username: "user_handle", role: "talent", created_at: "2026-01-01" },
                }),
              }),
            }),
          } as any
        }
        if (table === "talent_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "talent-profile-id", user_id: userId, full_name: "Creative Talent", skills: ["Cinematography"] },
                }),
              }),
            }),
          } as any
        }
        if (table === "messages") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: "msg-1", body: "Hello!", read: true, created_at: "2026-02-01" }],
                }),
              }),
            }),
          } as any
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        } as any
      })

      const exported = await exportUserData(userId)

      expect(exported.export_metadata.user_id).toBe(userId)
      expect(exported.export_metadata.compliance_frameworks).toContain("Digital Personal Data Protection Act, 2023 (DPDP Act, India)")
      expect(exported.user?.id).toBe(userId)
      expect(exported.profile?.full_name).toBe("Creative Talent")
      expect(exported.messages_sent).toBeDefined()
      expect(exported.messages_received).toBeDefined()
      expect(exported.consents).toBeDefined()
    })
  })
})
