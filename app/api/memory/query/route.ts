import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { searchMemoryLayered as searchMemory } from '@/lib/memory/query';
import { extractFacts } from '@/lib/memory/facts';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { query, topK = 5, includeFacts = false } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Search memory
    const chunks = await searchMemory(user.id, query, topK);

    // Optionally extract facts from retrieved chunks
    let facts = null;
    if (includeFacts && chunks.length > 0) {
      facts = await extractFacts(chunks);
    }

    return NextResponse.json({
      chunks,
      facts,
      query,
      userId: user.id,
    });
  } catch (error) {
    console.error('Memory query error:', error);
    return NextResponse.json(
      { error: 'Failed to query memory' },
      { status: 500 }
    );
  }
}
