// Proxy to Motia backend for starting imports
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startMotiaImport } from '@/lib/motia-client'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive')
    if (rateLimited) return rateLimited

    const { fileUrl, fileName } = await request.json()

    if (!fileUrl) {
      return NextResponse.json({ error: 'Missing fileUrl' }, { status: 400 })
    }

    // Call Motia backend
    const result = await startMotiaImport(user.id, fileUrl, fileName || 'export.zip')

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Update user status in Supabase
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        import_status: 'processing',
        import_started_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    return NextResponse.json({ success: true, message: 'Import started via Motia' })

  } catch (error) {
    console.error('[Motia/Start] Error:', error)
    return NextResponse.json(
      { error: 'Failed to start import' },
      { status: 500 }
    )
  }
}
