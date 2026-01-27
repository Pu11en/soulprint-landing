import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendImportInstructionsEmail } from '@/lib/email';

/**
 * POST /api/import/send-instructions
 * Send import instructions email to the current user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's name from metadata or email
    const name = user.user_metadata?.name || 
                 user.user_metadata?.full_name || 
                 user.email?.split('@')[0] || 
                 'there';

    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: 'No email address found' }, { status: 400 });
    }

    // Send the import instructions email
    const sent = await sendImportInstructionsEmail(email, name);

    if (!sent) {
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Import instructions sent! Check your email.',
    });

  } catch (error) {
    console.error('Error sending import instructions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
