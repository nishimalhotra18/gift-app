import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  })

  // Default error response
  let statusCode = 500
  let message = 'Internal Server Error'
  let code = 'INTERNAL_ERROR'

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation Error'
    code = 'VALIDATION_ERROR'
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401
    message = 'Unauthorized'
    code = 'UNAUTHORIZED'
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403
    message = 'Forbidden'
    code = 'FORBIDDEN'
  } else if (error.name === 'NotFoundError') {
    statusCode = 404
    message = 'Not Found'
    code = 'NOT_FOUND'
  } else if (error.name === 'ConflictError') {
    statusCode = 409
    message = 'Conflict'
    code = 'CONFLICT'
  } else if (error.name === 'TooManyRequestsError') {
    statusCode = 429
    message = 'Too Many Requests'
    code = 'TOO_MANY_REQUESTS'
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error'
  }

  res.status(statusCode).json({
    error: message,
    code,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  })
}
