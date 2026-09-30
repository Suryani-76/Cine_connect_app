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
  const statusCode = err.statusCode ?? 500
  const message = err.message ?? 'Internal Server Error'

  console.error(`[Error] ${statusCode} - ${message}`)

  res.status(statusCode).json({
    error: message,
  })
}
