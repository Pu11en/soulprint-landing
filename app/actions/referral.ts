'use server'

import { createClient } from '@/lib/supabase/server'

interface TeamMember {
    id: string
    name: string
    is_valid: boolean
}

/**
 * Validates a referral code and returns the team member info
 */
export async function validateReferralCode(code: string): Promise<{
    valid: boolean
    teamMember?: { id: string; name: string }
    error?: string
}> {
    if (!code || code.trim().length === 0) {
        return { valid: false, error: 'No referral code provided' }
    }

    try {
        const supabase = await createClient()

        // Use the RPC function to validate
        const { data, error } = await supabase
            .rpc('validate_referral_code', { code: code.trim().toUpperCase() })
            .single()

        if (error) {
            console.error('Error validating referral code:', error)
            return { valid: false, error: 'Failed to validate referral code' }
        }

        const result = data as TeamMember

        if (result && result.is_valid) {
            return {
                valid: true,
                teamMember: {
                    id: result.id,
                    name: result.name
                }
            }
        }

        return { valid: false, error: 'Invalid referral code' }
    } catch (err) {
        console.error('Error validating referral code:', err)
        return { valid: false, error: 'Failed to validate referral code' }
    }
}

/**
 * Records a referral after a user signs up
 * This should be called after the user account is created
 */
export async function recordReferral(
    referralCode: string,
    userId: string,
    userEmail: string
): Promise<{ success: boolean; error?: string }> {
    if (!referralCode || !userId || !userEmail) {
        return { success: false, error: 'Missing required parameters' }
    }

    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .rpc('record_referral', {
                p_referral_code: referralCode.trim().toUpperCase(),
                p_user_id: userId,
                p_user_email: userEmail
            })

        if (error) {
            console.error('Error recording referral:', error)
            return { success: false, error: 'Failed to record referral' }
        }

        return { success: data === true }
    } catch (err) {
        console.error('Error recording referral:', err)
        return { success: false, error: 'Failed to record referral' }
    }
}

/**
 * Gets the referral statistics for a team member
 * (For admin dashboard - requires service role)
 */
export async function getTeamMemberStats(teamMemberId: string): Promise<{
    totalReferrals: number
    recentReferrals: Array<{ email: string; createdAt: string }>
    error?: string
}> {
    try {
        const supabase = await createClient()

        // Get team member info
        const { data: teamMember, error: tmError } = await supabase
            .from('team_members')
            .select('total_referrals')
            .eq('id', teamMemberId)
            .single()

        if (tmError) {
            return { totalReferrals: 0, recentReferrals: [], error: tmError.message }
        }

        // Get recent referrals
        const { data: referrals, error: refError } = await supabase
            .from('referrals')
            .select('referred_email, created_at')
            .eq('team_member_id', teamMemberId)
            .order('created_at', { ascending: false })
            .limit(10)

        if (refError) {
            return { totalReferrals: teamMember?.total_referrals || 0, recentReferrals: [], error: refError.message }
        }

        return {
            totalReferrals: teamMember?.total_referrals || 0,
            recentReferrals: referrals?.map(r => ({
                email: r.referred_email,
                createdAt: r.created_at
            })) || []
        }
    } catch (err) {
        console.error('Error getting team member stats:', err)
        return { totalReferrals: 0, recentReferrals: [], error: 'Failed to get stats' }
    }
}

/**
 * Gets all team members with their referral counts
 * (For admin dashboard)
 */
export async function getAllTeamMembers(): Promise<{
    members: Array<{ id: string; name: string; referralCode: string; totalReferrals: number }>
    error?: string
}> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('team_members')
            .select('id, name, referral_code, total_referrals')
            .eq('is_active', true)
            .order('total_referrals', { ascending: false })

        if (error) {
            return { members: [], error: error.message }
        }

        return {
            members: data?.map(m => ({
                id: m.id,
                name: m.name,
                referralCode: m.referral_code,
                totalReferrals: m.total_referrals
            })) || []
        }
    } catch (err) {
        console.error('Error getting team members:', err)
        return { members: [], error: 'Failed to get team members' }
    }
}
