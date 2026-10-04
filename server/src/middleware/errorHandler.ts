import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
}

/**
 * Centralised error-handling middleware.
 * Mount this last, after all routes.
 */
export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode ?? 500
  let message = err.message ?? 'Internal Server Error'

  if (err.name === 'ZodError') {
    statusCode = 400
    try {
      const parsed = JSON.parse(err.message)
      if (Array.isArray(parsed) && parsed[0]?.message) {
        message = parsed[0].message
      }
    } catch {
      // keep message
    }
  }

  if (err.name === 'MulterError') {
    statusCode = 400
  }

  console.error(`[Error] ${statusCode} - ${message}`)

  res.status(statusCode).json({
    error: message,
  })
}
