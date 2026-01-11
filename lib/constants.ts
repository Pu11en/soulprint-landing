/**
 * Application Constants
 * Centralized location for magic numbers and configuration values
 */

// ============================================
// Authentication & Security
// ============================================

/** Minimum password length for user registration */
export const MIN_PASSWORD_LENGTH = 8;

/** Maximum length for user names */
export const MAX_NAME_LENGTH = 100;

/** Maximum length for email addresses (per RFC 5321) */
export const MAX_EMAIL_LENGTH = 254;

/** Default trial usage limit for new users */
export const DEFAULT_USAGE_LIMIT = 20;

// ============================================
// Pagination
// ============================================

/** Default number of items per page */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum allowed page size */
export const MAX_PAGE_SIZE = 100;

/** Number of sessions to show in sidebar */
export const SESSIONS_PAGE_SIZE = 20;

// ============================================
// Chat & Messages
// ============================================

/** Maximum message length */
export const MAX_MESSAGE_LENGTH = 10000;

/** Number of messages to load initially */
export const INITIAL_MESSAGES_LIMIT = 50;

/** Preview length for session last message */
export const SESSION_PREVIEW_LENGTH = 50;

// ============================================
// Rate Limiting
// ============================================

/** Auth attempts per minute */
export const RATE_LIMIT_AUTH_REQUESTS = 5;
export const RATE_LIMIT_AUTH_WINDOW_MS = 60 * 1000;

/** API calls per minute */
export const RATE_LIMIT_API_REQUESTS = 60;
export const RATE_LIMIT_API_WINDOW_MS = 60 * 1000;

/** Chat messages per minute */
export const RATE_LIMIT_CHAT_REQUESTS = 30;
export const RATE_LIMIT_CHAT_WINDOW_MS = 60 * 1000;

/** Waitlist submissions per hour */
export const RATE_LIMIT_WAITLIST_REQUESTS = 3;
export const RATE_LIMIT_WAITLIST_WINDOW_MS = 60 * 60 * 1000;

/** Gate registrations per hour */
export const RATE_LIMIT_GATE_REQUESTS = 5;
export const RATE_LIMIT_GATE_WINDOW_MS = 60 * 60 * 1000;

// ============================================
// File Upload
// ============================================

/** Maximum audio file size in bytes (10MB) */
export const MAX_AUDIO_FILE_SIZE = 10 * 1024 * 1024;

/** Supported audio formats */
export const SUPPORTED_AUDIO_FORMATS = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg'];

// ============================================
// API Configuration
// ============================================

/** API timeout for SoulPrint generation (5 minutes) */
export const SOULPRINT_GENERATION_TIMEOUT_MS = 300 * 1000;

/** Default model for chat completions */
export const DEFAULT_CHAT_MODEL = 'hermes3';

/** Image cache TTL in seconds (24 hours) */
export const IMAGE_CACHE_TTL = 86400;

// ============================================
// UI Configuration
// ============================================

/** Animation durations in milliseconds */
export const ANIMATION_DURATION_FAST = 150;
export const ANIMATION_DURATION_NORMAL = 300;
export const ANIMATION_DURATION_SLOW = 500;

/** Mobile breakpoint in pixels */
export const MOBILE_BREAKPOINT = 768;

/** Sidebar width in pixels */
export const SIDEBAR_WIDTH = 256;

// ============================================
// Streak CRM
// ============================================

/** Stage key for leads that have been collected */
export const STREAK_STAGE_LEAD_COLLECTED = '5001';

/** Streak field keys */
export const STREAK_FIELD_ROLE = '1001';
export const STREAK_FIELD_AFFILIATION = '1002';

// ============================================
// Questionnaire
// ============================================

/** Number of slider questions in questionnaire */
export const QUESTIONNAIRE_SLIDER_COUNT = 18;

/** Number of text questions in questionnaire */
export const QUESTIONNAIRE_TEXT_COUNT = 18;

/** Slider value range */
export const SLIDER_MIN = 0;
export const SLIDER_MAX = 100;
export const SLIDER_DEFAULT = 50;
