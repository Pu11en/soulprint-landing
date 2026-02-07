/**
 * Email sending utility using Resend
 *
 * sendSoulprintReadyEmail removed (v1.2) -- users now go directly to chat
 * after quick pass, no email needed.
 */

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = 'SoulPrint <noreply@soulprint.so>';

// Resend client and FROM_EMAIL kept for future email features (waitlist, etc.)
export { resend, FROM_EMAIL };
