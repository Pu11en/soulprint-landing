/**
 * Get/Set AI name for user
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { handleAPIError } from '@/lib/api/error-handler';
import { parseRequestBody, aiNameSchema } from '@/lib/api/schemas';
import { checkRateLimit } from '@/lib/rate-limit';

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET - retrieve AI name
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = getSupabaseAdmin();
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('ai_name, identity_md')
      .eq('user_id', user.id)
      .single();

    // Parse signature_greeting from identity_md
    let signatureGreeting: string | null = null;
    if (profile?.identity_md) {
      try {
        const identity = JSON.parse(profile.identity_md);
        const greeting = identity?.signature_greeting;
        if (typeof greeting === 'string' && greeting.trim() && greeting.toLowerCase() !== 'not enough data') {
          signatureGreeting = greeting.trim();
        }
      } catch {
        // JSON parse failed, leave as null
      }
    }

    return NextResponse.json({
      aiName: profile?.ai_name || null,
      hasName: !!profile?.ai_name,
      signatureGreeting,
    });
  } catch (error) {
    return handleAPIError(error, 'API:ProfileAiName:GET');
  }
}

// POST - set AI name
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'standard');
    if (rateLimited) return rateLimited;

    // Parse and validate request body
    const result = await parseRequestBody(request, aiNameSchema);
    if (result instanceof Response) return result;
    const { name } = result;

    const cleanName = name.slice(0, 50); // Limit to 50 chars (trim is in schema)

    const adminSupabase = getSupabaseAdmin();
    const { error: updateError } = await adminSupabase
      .from('user_profiles')
      .update({ ai_name: cleanName, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating AI name:', updateError);
      return NextResponse.json({ error: 'Failed to save name' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      aiName: cleanName,
    });
  } catch (error) {
    return handleAPIError(error, 'API:ProfileAiName:POST');
  }
}
