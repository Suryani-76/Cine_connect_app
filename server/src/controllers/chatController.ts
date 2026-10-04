import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import {
  sendMessage,
  getConversations,
  getMessagesWithUser,
  markConversationRead,
  blockUser,
  unblockUser,
  getBlockedUsers,
  createReport,
  getAdminReports,
  updateAdminReport,
} from '../services/chatService'

const sendMessageSchema = z.object({
  recipient_id: z.string().uuid('Invalid recipient ID format'),
  body: z.string().min(1, 'Message body cannot be empty').max(2000, 'Message body exceeds 2000 characters'),
})

const markReadSchema = z.object({
  other_user_id: z.string().uuid('Invalid user ID format'),
})

const blockUserSchema = z.object({
  blocked_id: z.string().uuid('Invalid blocked user ID format'),
})

const createReportSchema = z.object({
  target_user_id: z.string().uuid('Invalid target user ID format'),
  message_id: z.string().uuid().optional(),
  reason: z.enum(['spam', 'harassment', 'scam', 'inappropriate', 'other']),
  details: z.string().max(1000, 'Details cannot exceed 1000 characters').optional(),
})

const updateReportSchema = z.object({
  status: z.enum(['open', 'reviewed', 'actioned']),
  resolution_notes: z.string().max(1000).optional(),
})

export const sendMessageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { recipient_id, body } = sendMessageSchema.parse(req.body)
    const message = await sendMessage(req.caller, recipient_id, body)
    res.status(201).json({ message })
  } catch (err) {
    next(err)
  }
}

export const getConversationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const page = parseInt((req.query.page as string) || '1', 10)
    const limit = parseInt((req.query.limit as string) || '20', 10)

    const result = await getConversations(req.caller, page, limit)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const getMessagesWithUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const otherUserId = Array.isArray(req.params.otherUserId)
      ? req.params.otherUserId[0]
      : req.params.otherUserId
    if (!otherUserId) {
      res.status(400).json({ error: 'otherUserId parameter is required' })
      return
    }

    const cursor = (req.query.cursor as string) || undefined
    const limit = parseInt((req.query.limit as string) || '30', 10)

    const result = await getMessagesWithUser(req.caller, otherUserId, cursor, limit)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const markConversationReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { other_user_id } = markReadSchema.parse(req.body)
    const result = await markConversationRead(req.caller, other_user_id)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const blockUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const { blocked_id } = blockUserSchema.parse(req.body)
    const block = await blockUser(req.caller.userId, blocked_id)
    res.status(201).json({ success: true, ...block })
  } catch (err) {
    next(err)
  }
}

export const unblockUserHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId
    if (!userId) {
      res.status(400).json({ error: 'userId parameter is required' })
      return
    }

    const result = await unblockUser(req.caller.userId, userId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const getBlockedUsersHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const blocks = await getBlockedUsers(req.caller.userId)
    res.status(200).json({ blocks })
  } catch (err) {
    next(err)
  }
}

export const createReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const parsed = createReportSchema.parse(req.body)
    const report = await createReport(req.caller.userId, parsed)
    res.status(201).json({ report })
  } catch (err) {
    next(err)
  }
}

export const getAdminReportsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = (req.query.status as string) || undefined
    const page = parseInt((req.query.page as string) || '1', 10)
    const limit = parseInt((req.query.limit as string) || '20', 10)

    const result = await getAdminReports(status, page, limit)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const updateAdminReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.caller) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!reportId) {
      res.status(400).json({ error: 'Report ID parameter is required' })
      return
    }

    const parsed = updateReportSchema.parse(req.body)
    const report = await updateAdminReport(
      req.caller.userId,
      reportId,
      parsed.status,
      parsed.resolution_notes
    )
    res.status(200).json({ report })
  } catch (err) {
    next(err)
  }
}
