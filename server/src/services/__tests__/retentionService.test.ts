import { describe, it, expect, vi, beforeEach } from "vitest"
import { purgeOldReadNotifications, purgeOldEmailOutbox, runRetentionPurge } from "../retentionService"
import { supabase } from "../../db/supabase"

vi.mock("../../db/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe("retentionService - Scheduled Data Purging", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("purges read notifications older than 90 days", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "notif-1" }, { id: "notif-2" }],
      error: null,
    })
    const mockLt = vi.fn().mockReturnValue({ select: mockSelect })
    const mockEq = vi.fn().mockReturnValue({ lt: mockLt })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })

    vi.mocked(supabase.from).mockReturnValue({
      delete: mockDelete,
    } as any)

    const count = await purgeOldReadNotifications(90)

    expect(supabase.from).toHaveBeenCalledWith("notifications")
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith("read", true)
    expect(mockLt).toHaveBeenCalledWith("created_at", expect.any(String))
    expect(count).toBe(2)
  })

  it("purges email_outbox records older than 30 days", async () => {
    const mockSelect = vi.fn().mockResolvedValue({
      data: [{ id: "email-1" }],
      error: null,
    })
    const mockLt = vi.fn().mockReturnValue({ select: mockSelect })
    const mockDelete = vi.fn().mockReturnValue({ lt: mockLt })

    vi.mocked(supabase.from).mockReturnValue({
      delete: mockDelete,
    } as any)

    const count = await purgeOldEmailOutbox(30)

    expect(supabase.from).toHaveBeenCalledWith("email_outbox")
    expect(mockDelete).toHaveBeenCalled()
    expect(mockLt).toHaveBeenCalledWith("created_at", expect.any(String))
    expect(count).toBe(1)
  })

  it("executes combined retention purge job", async () => {
    const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    const mockLt = vi.fn().mockReturnValue({ select: mockSelect })
    const mockEq = vi.fn().mockReturnValue({ lt: mockLt })
    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq, lt: mockLt })

    vi.mocked(supabase.from).mockReturnValue({
      delete: mockDelete,
    } as any)

    const result = await runRetentionPurge()

    expect(result).toHaveProperty("notificationsPurged")
    expect(result).toHaveProperty("outboxPurged")
    expect(result).toHaveProperty("executedAt")
  })
})
