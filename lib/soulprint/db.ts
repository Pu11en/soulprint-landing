import { SupabaseClient } from '@supabase/supabase-js';
import type { SoulPrintData } from '@/lib/soulprint/types';

export async function saveSoulPrint(
    supabase: SupabaseClient,
    userId: string,
    soulprintData: SoulPrintData,
    userData?: { email?: string; full_name?: string; avatar_url?: string }
) {
    // 1. Ensure profile exists (fail-safe for missing trigger/race condition)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error checking profile:', profileError);
    }

    if (!profile) {
        console.log('⚠️ Profile missing for user, creating fail-safe profile:', userId);
        const { error: insertError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                email: userData?.email || 'unknown@soulprint.ai',
                full_name: userData?.full_name || '',
                avatar_url: userData?.avatar_url || ''
            });

        if (insertError) {
            console.error('Failed to create fail-safe profile:', insertError);
            // We ignore errors here if it's a conflict (another process created it)
            if (insertError.code !== '23505') {
                throw new Error(`Profile creation failed: ${insertError.message}`);
            }
        }
    }

    // 2. Check existing soulprints count (Limit: 2)
    const { count, error: countError } = await supabase
        .from('soulprints')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (countError) {
        console.error('Error checking soulprint count:', countError);
        throw new Error('Failed to check soulprint count');
    }

    const SOULPRINT_LIMIT = 2;

    if (count !== null && count >= SOULPRINT_LIMIT) {
        // Logic choice: For now, if limit reached, we update the most recent one?
        // User said "each user can only make two".
        // Let's allow updating the LATEST one if they are hitting the limit, so they aren't stuck?
        // OR better: Throw error so they know.
        // But to make it "user friendly" for Demo user who might just be retrying...
        // Let's implement: If limit reached, Update the most recently created one (simulate overwrite of "active" one).
        // Actually, let's just error for safety, assuming the UI handles it or the user deletes.
        // BUT, the current UI doesn't have delete.
        // So, to prevent "Demo User Stuck" state:
        // If count >= 2, Update the one with the latest `updated_at`.

        const { data: latest } = await supabase
            .from('soulprints')
            .select('id')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (latest) {
            console.log('⚠️ Limit reached. Updating latest SoulPrint:', latest.id);
            const { error } = await supabase
                .from('soulprints')
                .update({
                    soulprint_data: soulprintData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', latest.id);
            if (error) throw error;
            return { id: latest.id };
        }
    } else {
        // Create NEW SoulPrint
        const { data, error } = await supabase
            .from('soulprints')
            .insert({
                user_id: userId,
                soulprint_data: soulprintData,
                updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (error) throw error;
        return { id: data.id };
    }
    // Fallback if logic misses (shouldn't happen with updated logic)
    return { id: '' };
}
