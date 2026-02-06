/**
 * Synthesize learned facts into updated soulprint
 * This periodically updates the soulprint_text with new learnings
 * Call via cron or manually to keep soulprint current
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { handleAPIError } from '@/lib/api/error-handler';
import { checkRateLimit } from '@/lib/rate-limit';

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

let _bedrockClient: BedrockRuntimeClient | null = null;
function getBedrockClient(): BedrockRuntimeClient {
  if (!_bedrockClient) {
    _bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _bedrockClient;
}

interface LearnedFact {
  id: string;
  fact: string;
  category: string;
  confidence: number;
  created_at: string;
}

/**
 * Synthesize new facts into an updated soulprint section
 */
async function synthesizeFacts(
  existingSoulprint: string,
  newFacts: LearnedFact[]
): Promise<string> {
  const factsByCategory: Record<string, string[]> = {};
  
  for (const fact of newFacts) {
    if (!factsByCategory[fact.category]) {
      factsByCategory[fact.category] = [];
    }
    factsByCategory[fact.category].push(fact.fact);
  }

  const factsText = Object.entries(factsByCategory)
    .map(([category, facts]) => `${category}:\n${facts.map(f => `- ${f}`).join('\n')}`)
    .join('\n\n');

  const prompt = `You are updating a user's AI persona (soulprint) with newly learned facts from their conversations.

EXISTING SOULPRINT:
${existingSoulprint}

---

NEW FACTS LEARNED FROM RECENT CONVERSATIONS:
${factsText}

---

TASK: Generate an UPDATED soulprint that incorporates these new learnings naturally. 

Guidelines:
1. Preserve the tone and style of the existing soulprint
2. Integrate new facts where they fit naturally
3. Update any outdated information with new learnings
4. Add a new "Recent Learnings" section at the end for facts that don't fit elsewhere
5. Keep the soulprint concise but comprehensive
6. Don't lose any existing personality/context that's still relevant

Return ONLY the updated soulprint text, no explanations.`;

  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const response = await getBedrockClient().send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.content[0]?.text || existingSoulprint;
}

/**
 * Process a single user's soulprint synthesis
 */
async function synthesizeUserSoulprint(userId: string): Promise<{ updated: boolean; factsProcessed: number }> {
  // Get user's current soulprint
  const { data: profile, error: profileError } = await getSupabase()
    .from('user_profiles')
    .select('soulprint_text, soulprint_updated_at')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile?.soulprint_text) {
    console.log(`[Synthesize] No soulprint for user ${userId}`);
    return { updated: false, factsProcessed: 0 };
  }

  // Get learned facts since last synthesis (or all if never synthesized)
  const sinceDate = profile.soulprint_updated_at || '2020-01-01';
  
  const { data: newFacts, error: factsError } = await getSupabase()
    .from('learned_facts')
    .select('id, fact, category, confidence, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('created_at', sinceDate)
    .order('created_at', { ascending: true })
    .limit(100);

  if (factsError) {
    console.error(`[Synthesize] Error fetching facts for ${userId}:`, factsError);
    return { updated: false, factsProcessed: 0 };
  }

  if (!newFacts || newFacts.length === 0) {
    console.log(`[Synthesize] No new facts for user ${userId}`);
    return { updated: false, factsProcessed: 0 };
  }

  console.log(`[Synthesize] Processing ${newFacts.length} new facts for user ${userId}`);

  // Synthesize new soulprint
  const updatedSoulprint = await synthesizeFacts(profile.soulprint_text, newFacts);

  // Update the profile
  const { error: updateError } = await getSupabase()
    .from('user_profiles')
    .update({
      soulprint_text: updatedSoulprint,
      soulprint_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error(`[Synthesize] Error updating soulprint for ${userId}:`, updateError);
    return { updated: false, factsProcessed: 0 };
  }

  console.log(`[Synthesize] Updated soulprint for user ${userId} with ${newFacts.length} facts`);
  return { updated: true, factsProcessed: newFacts.length };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch((e) => { console.warn("[JSON parse]", e); return {}; });
    const { userId } = body;

    // Rate limit check - only if userId provided (not for cron/batch)
    if (userId) {
      const rateLimited = await checkRateLimit(userId, 'expensive');
      if (rateLimited) return rateLimited;
    }

    if (userId) {
      // Process specific user
      const result = await synthesizeUserSoulprint(userId);
      return NextResponse.json({ success: true, userId, ...result });
    }

    // Process all users with new facts (called by cron)
    // Find users with learned_facts newer than their soulprint_updated_at
    const { data: usersWithNewFacts } = await getSupabase()
      .from('learned_facts')
      .select('user_id')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!usersWithNewFacts || usersWithNewFacts.length === 0) {
      return NextResponse.json({ success: true, message: 'No users with new facts' });
    }

    // Dedupe user IDs
    const uniqueUserIds = [...new Set(usersWithNewFacts.map(u => u.user_id))];
    
    const results = [];
    for (const uid of uniqueUserIds.slice(0, 10)) { // Limit to 10 users per run
      const result = await synthesizeUserSoulprint(uid);
      results.push({ userId: uid, ...result });
    }

    return NextResponse.json({
      success: true,
      processed: results.filter(r => r.updated).length,
      results,
    });

  } catch (error) {
    return handleAPIError(error, 'API:MemorySynthesize');
  }
}

// GET endpoint for Vercel Cron
export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Trigger synthesis for all users
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({}),
  }));
}
