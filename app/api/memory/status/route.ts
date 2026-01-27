import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ status: 'none' });
    }

    // Check if user has any memories
    const { count, error: memoryError } = await supabase
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (memoryError) {
      console.error('Error checking memories:', memoryError);
      return NextResponse.json({ status: 'none' });
    }

    // Check if user has requested import (sent instructions)
    const { data: importRequest } = await supabase
      .from('import_requests')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (count && count > 0) {
      return NextResponse.json({ 
        status: 'ready',
        memoryCount: count 
      });
    }

    if (importRequest) {
      return NextResponse.json({ 
        status: 'pending',
        importStatus: importRequest.status 
      });
    }

    return NextResponse.json({ status: 'none' });
  } catch (error) {
    console.error('Memory status error:', error);
    return NextResponse.json({ status: 'none' });
  }
}
