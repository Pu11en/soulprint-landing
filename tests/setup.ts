import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { server } from './mocks/server'

// Mock logger to prevent Pino from writing during tests
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLoggerInstance),
}

vi.mock('@/lib/logger', () => ({
  logger: mockLoggerInstance,
  createLogger: vi.fn(() => mockLoggerInstance),
}))

// Mock rate limiting to prevent Redis calls in tests
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())
