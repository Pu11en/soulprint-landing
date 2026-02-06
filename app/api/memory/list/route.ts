import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleAPIError } from '@/lib/api/error-handler';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('conversation_chunks')
      .select('id, conversation_id, title, content, message_count, created_at, is_recent', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Add search filter if provided
    if (search.trim()) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: chunks, error, count } = await query;

    if (error) {
      console.error('Error fetching chunks:', error);
      return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
    }

    // Transform to memory items with snippets
    const memories = (chunks || []).map(chunk => ({
      id: chunk.id,
      conversationId: chunk.conversation_id,
      title: chunk.title,
      snippet: truncateContent(chunk.content, 200),
      fullContent: chunk.content,
      messageCount: chunk.message_count,
      createdAt: chunk.created_at,
      isRecent: chunk.is_recent,
      source: 'ChatGPT Import',
    }));

    return NextResponse.json({
      memories,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return handleAPIError(error, 'API:MemoryList');
  }
}

function truncateContent(content: string, maxLength: number): string {
  if (!content) return '';
  
  // Clean up the content for display
  const cleaned = content
    .replace(/^(User|AI):\s*/gm, '') // Remove role prefixes
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
  
  if (cleaned.length <= maxLength) return cleaned;
  
  return cleaned.slice(0, maxLength).trim() + '...';
}
