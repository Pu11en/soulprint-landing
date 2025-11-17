import rateLimit from 'express-rate-limit';

// General rate limiting for all API endpoints
export const generalRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 900000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Rate limiting for file uploads
export const uploadRateLimit = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: {
    error: 'Too many upload attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for video processing/export
export const exportRateLimit = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 3, // limit each IP to 3 exports per hour
  message: {
    error: 'Too many export requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom rate limiting middleware for more control
export const customRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: options.message || 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
  });
};

export default {
  generalRateLimit,
  authRateLimit,
  uploadRateLimit,
  exportRateLimit,
  customRateLimit,
};