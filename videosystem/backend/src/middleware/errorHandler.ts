import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Supabase error handling
  if (err.message?.includes('duplicate key')) {
    const message = 'Resource already exists';
    error = new CustomError(message, 409);
  }

  // Supabase foreign key constraint
  if (err.message?.includes('foreign key constraint')) {
    const message = 'Referenced resource does not exist';
    error = new CustomError(message, 400);
  }

  // Supabase row level security
  if (err.message?.includes('row-level security')) {
    const message = 'Access denied';
    error = new CustomError(message, 403);
  }

  // Validation error
  if (err.message?.includes('validation')) {
    const message = 'Invalid input data';
    error = new CustomError(message, 400);
  }

  // JWT error
  if (err.message?.includes('jwt')) {
    const message = 'Invalid or expired token';
    error = new CustomError(message, 401);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new CustomError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

export default {
  errorHandler,
  asyncHandler,
  notFound,
  CustomError,
};