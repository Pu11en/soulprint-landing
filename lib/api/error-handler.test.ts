import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAPIError, APIErrorResponse } from './error-handler';
import * as logger from '@/lib/logger';

describe('handleAPIError', () => {
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock the Pino logger's error method
    loggerErrorSpy = vi.spyOn(logger.logger, 'error').mockImplementation(() => logger.logger);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('should return 504 with TIMEOUT code for TimeoutError', async () => {
    const timeoutError = new Error('Operation timed out');
    timeoutError.name = 'TimeoutError';

    const response = handleAPIError(timeoutError, 'API:Test');

    expect(response.status).toBe(504);

    const body = (await response.json()) as APIErrorResponse;
    expect(body.error).toBe('Request timed out');
    expect(body.code).toBe('TIMEOUT');
    expect(body.timestamp).toBeDefined();
  });

  it('should include error.message in development mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const error = new Error('Detailed error message');
    const response = handleAPIError(error, 'API:Test');

    expect(response.status).toBe(500);

    const body = (await response.json()) as APIErrorResponse;
    expect(body.error).toBe('Detailed error message');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.timestamp).toBeDefined();
  });

  it('should return generic message in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const error = new Error('Sensitive internal details');
    const response = handleAPIError(error, 'API:Test');

    expect(response.status).toBe(500);

    const body = (await response.json()) as APIErrorResponse;
    expect(body.error).toBe('An error occurred');
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.timestamp).toBeDefined();
  });

  it('should handle unknown error types (string)', async () => {
    const response = handleAPIError('string error', 'API:Test');

    expect(response.status).toBe(500);

    const body = (await response.json()) as APIErrorResponse;
    expect(body.error).toBe('An unexpected error occurred');
    expect(body.code).toBe('UNKNOWN_ERROR');
    expect(body.timestamp).toBeDefined();
  });

  it('should handle unknown error types (number)', async () => {
    const response = handleAPIError(12345, 'API:Test');

    expect(response.status).toBe(500);

    const body = (await response.json()) as APIErrorResponse;
    expect(body.error).toBe('An unexpected error occurred');
    expect(body.code).toBe('UNKNOWN_ERROR');
    expect(body.timestamp).toBeDefined();
  });

  it('should handle unknown error types (null)', async () => {
    const response = handleAPIError(null, 'API:Test');

    expect(response.status).toBe(500);

    const body = (await response.json()) as APIErrorResponse;
    expect(body.error).toBe('An unexpected error occurred');
    expect(body.code).toBe('UNKNOWN_ERROR');
    expect(body.timestamp).toBeDefined();
  });

  it('should include timestamp in all responses', async () => {
    const beforeTime = Date.now();
    const response = handleAPIError(new Error('test'), 'API:Test');
    const afterTime = Date.now();

    const body = (await response.json()) as APIErrorResponse;
    expect(body.timestamp).toBeDefined();

    const timestampMs = new Date(body.timestamp).getTime();
    expect(timestampMs).toBeGreaterThanOrEqual(beforeTime);
    expect(timestampMs).toBeLessThanOrEqual(afterTime);
  });

  it('should log error with structured logging via Pino', () => {
    const error = new Error('test error');
    handleAPIError(error, 'API:ChatMessages');

    // Verify Pino logger was called (not console.error)
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('should log context for non-Error types with structured logging', () => {
    const unknownError = { some: 'object' };
    handleAPIError(unknownError, 'API:CustomContext');

    // Verify Pino logger was called with structured data
    expect(loggerErrorSpy).toHaveBeenCalled();
  });
});
