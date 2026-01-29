import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { memoryId, memoryIds } = body;

    // Support single deletion or bulk deletion
    const idsToDelete = memoryIds || (memoryId ? [memoryId] : []);
    
    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: 'No memory IDs provided' }, { status: 400 });
    }

    // Delete the chunks (with user_id check for security)
    const { error, count } = await supabase
      .from('conversation_chunks')
      .delete()
      .eq('user_id', user.id)
      .in('id', idsToDelete);

    if (error) {
      console.error('Error deleting memories:', error);
      return NextResponse.json({ error: 'Failed to delete memories' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: count || idsToDelete.length,
    });
  } catch (error) {
    console.error('Memory delete error:', error);
    return NextResponse.json({ error: 'Failed to delete memories' }, { status: 500 });
  }
}
