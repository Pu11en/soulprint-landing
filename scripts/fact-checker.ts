/**
 * RLM Fact Checker
 * Verifies RLM responses against actual conversation data
 * 
 * Usage: npx tsx scripts/fact-checker.ts "query" "user_id"
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function searchConversations(userId: string, keywords: string[]): Promise<{title: string, content: string, matches: string[]}[]> {
  // Get all chunks for user
  const { data: chunks } = await supabase
    .from('conversation_chunks')
    .select('title, content')
    .eq('user_id', userId);

  if (!chunks) return [];

  // Search for keywords in chunks
  const results: {title: string, content: string, matches: string[]}[] = [];
  
  for (const chunk of chunks) {
    const matches: string[] = [];
    const contentLower = chunk.content.toLowerCase();
    
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    }
    
    if (matches.length > 0) {
      results.push({
        title: chunk.title,
        content: chunk.content.slice(0, 500),
        matches
      });
    }
  }

  return results.sort((a, b) => b.matches.length - a.matches.length);
}

async function factCheck(query: string, userId: string) {
  console.log('\n🔍 FACT CHECKER');
  console.log('================');
  console.log(`Query: "${query}"`);
  console.log(`User ID: ${userId}`);
  
  // Extract keywords from query
  const stopWords = ['what', 'is', 'my', 'the', 'a', 'an', 'about', 'do', 'you', 'know', 'tell', 'me', 'how', 'when', 'where', 'why', 'i', 'am', 'are', 'was', 'were', 'have', 'has', 'had', 'be', 'been', 'being'];
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(' ')
    .filter(w => w.length > 2 && !stopWords.includes(w));
  
  console.log(`\n📋 Keywords: ${keywords.join(', ')}`);
  
  // Search conversations
  const results = await searchConversations(userId, keywords);
  
  console.log(`\n📊 Found ${results.length} matching conversations:\n`);
  
  for (const result of results.slice(0, 10)) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📁 ${result.title}`);
    console.log(`🏷️  Matches: ${result.matches.join(', ')}`);
    console.log(`📝 Preview:`);
    console.log(result.content.replace(/\n/g, '\n   '));
    console.log('');
  }
  
  // Summary
  console.log(`\n✅ VERIFICATION SUMMARY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total conversations searched: ${(await supabase.from('conversation_chunks').select('id', {count: 'exact'}).eq('user_id', userId)).count}`);
  console.log(`Conversations with matches: ${results.length}`);
  console.log(`Top matching conversation: ${results[0]?.title || 'None'}`);
}

// Run
const query = process.argv[2] || 'projects';
const userId = process.argv[3] || '79898043-3620-40ee-9e49-58a0e1ea4e2c'; // asset

factCheck(query, userId).catch(console.error);
