/**
 * GET /api/storage/token — Return fresh access token for direct Storage uploads
 *
 * The server-side session (from cookies via middleware) always has a valid,
 * freshly-refreshed token. Client-side session can have stale/corrupted tokens
 * in some browsers. This endpoint bridges that gap for TUS uploads.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ token: session.access_token });
}
