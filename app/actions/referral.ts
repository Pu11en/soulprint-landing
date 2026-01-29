'use server'

import { createClient } from '@supabase/supabase-js'

// Create admin client with service role for referral operations
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function recordReferral(
  referralCode: string,
  userId: string,
  email: string
) {
  if (!referralCode || !userId) {
    return { success: false, error: 'Missing required parameters' }
  }

  try {
    const supabase = getAdminClient()
    
    // Call the RPC function to record the referral
    const { data, error } = await supabase.rpc('record_referral', {
      p_referral_code: referralCode.toUpperCase(),
      p_user_id: userId,
      p_user_email: email,
    })

    if (error) {
      console.error('Error recording referral:', error)
      return { success: false, error: error.message }
    }

    console.log('Referral recorded successfully:', data)
    return data
  } catch (err) {
    console.error('Exception recording referral:', err)
    return { success: false, error: 'Failed to record referral' }
  }
}

export async function validateReferralCode(code: string) {
  if (!code) {
    return { valid: false, teamMember: null }
  }

  try {
    const supabase = getAdminClient()
    
    const { data, error } = await supabase
      .from('team_referral_codes')
      .select('team_member_name')
      .eq('code', code.toUpperCase())
      .single()

    if (error || !data) {
      return { valid: false, teamMember: null }
    }

    return { valid: true, teamMember: data.team_member_name }
  } catch {
    return { valid: false, teamMember: null }
  }
}
