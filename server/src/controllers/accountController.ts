import { Request, Response, NextFunction } from "express"
import { exportUserData, deleteUserAccount } from "../services/accountService"

/**
 * GET /account/export
 * Rate-limited: 1 per hour per user.
 * Exports all user data in JSON format per DPDP Act 2023 & GDPR Art. 20.
 */
export const exportAccountData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.caller?.userId ?? (req as unknown as { user?: { id: string } }).user?.id
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    const data = await exportUserData(userId)
    const filename = `cineconnect-data-export-${new Date().toISOString().slice(0, 10)}.json`

    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.status(200).json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /account
 * Permanently erases the authenticated user, their profiles, jobs/apps, and storage objects.
 */
export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.caller?.userId ?? (req as unknown as { user?: { id: string } }).user?.id
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    await deleteUserAccount(userId)
    res.status(200).json({ message: "Account and all associated personal data have been permanently deleted." })
  } catch (err) {
    next(err)
  }
}
