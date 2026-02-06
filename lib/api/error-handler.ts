import { NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('ErrorHandler');

export interface APIErrorResponse {
  error: string;
  code: string;
  timestamp: string;
  correlationId?: string;
}

/**
 * Standardized API error handler with structured logging
 *
 * @param error - The error object (unknown type)
 * @param context - Context string for logging (e.g., 'API:ChatMessages')
 * @param correlationId - Optional correlation ID for request tracing
 * @returns NextResponse with structured error response
 */
export function handleAPIError(error: unknown, context: string, correlationId?: string): Response {
  const timestamp = new Date().toISOString();
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Structured error logging with correlation ID
  if (error instanceof Error) {
    log.error({
      correlationId,
      context,
      error: {
        message: error.message,
        name: error.name,
        ...(isDevelopment ? { stack: error.stack } : {}),
      },
    }, 'API error occurred');
  } else {
    log.error({
      correlationId,
      context,
      error: { type: typeof error, value: String(error) },
    }, 'API error occurred (unknown type)');
  }

  // Handle TimeoutError from AbortSignal.timeout
  if (error instanceof Error && error.name === 'TimeoutError') {
    return NextResponse.json<APIErrorResponse>(
      {
        error: 'Request timed out',
        code: 'TIMEOUT',
        timestamp,
        correlationId,
      },
      { status: 504 }
    );
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return NextResponse.json<APIErrorResponse>(
      {
        error: isDevelopment ? error.message : 'An error occurred',
        code: 'INTERNAL_ERROR',
        timestamp,
        correlationId,
      },
      { status: 500 }
    );
  }

  // Handle unknown error types (string, number, null, etc.)
  return NextResponse.json<APIErrorResponse>(
    {
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      timestamp,
      correlationId,
    },
    { status: 500 }
  );
}
