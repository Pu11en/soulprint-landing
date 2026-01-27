/**
 * Simple test upload - bypasses R2, processes directly
 * For testing the parsing flow only
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Accept up to 50MB for direct upload test
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`[Test Upload] File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    const arrayBuffer = await file.arrayBuffer();
    
    let conversationsJson: string;
    
    // Handle both ZIP and direct JSON
    if (file.name.endsWith('.zip')) {
      console.log('[Test Upload] Processing ZIP...');
      const zip = await JSZip.loadAsync(arrayBuffer);
      const conversationsFile = zip.file('conversations.json');
      
      if (!conversationsFile) {
        return NextResponse.json({ error: 'conversations.json not found in ZIP' }, { status: 400 });
      }
      
      conversationsJson = await conversationsFile.async('string');
    } else if (file.name.endsWith('.json')) {
      console.log('[Test Upload] Processing JSON directly...');
      conversationsJson = Buffer.from(arrayBuffer).toString('utf-8');
    } else {
      return NextResponse.json({ error: 'Please upload a ZIP or JSON file' }, { status: 400 });
    }

    console.log(`[Test Upload] conversations.json size: ${(conversationsJson.length / 1024 / 1024).toFixed(2)}MB`);

    // Parse conversations
    const rawConversations = JSON.parse(conversationsJson);
    
    // Count stats
    let totalMessages = 0;
    const conversationTitles: string[] = [];
    
    for (const conv of rawConversations) {
      conversationTitles.push(conv.title || 'Untitled');
      if (conv.mapping) {
        for (const node of Object.values(conv.mapping) as any[]) {
          if (node.message?.content?.parts?.length > 0) {
            totalMessages++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        jsonSize: `${(conversationsJson.length / 1024 / 1024).toFixed(2)}MB`,
        conversationCount: rawConversations.length,
        totalMessages,
        sampleTitles: conversationTitles.slice(0, 10),
      }
    });

  } catch (error) {
    console.error('[Test Upload] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
