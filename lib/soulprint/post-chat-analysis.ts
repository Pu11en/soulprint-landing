/**
 * POST-CHAT ANALYSIS ENGINE
 * Analyzes conversation threads and evolves the SoulPrint over time.
 * 
 * This is the "Evolution Engine" - it doesn't just remember events,
 * it updates the user's identity profile based on patterns.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { chatCompletion, ChatMessage } from '@/lib/llm/local-client';
import type { SoulPrintData } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface EvolutionInsight {
    type: 'value_shift' | 'new_pattern' | 'emotional_anchor' | 'relationship_update' | 'project_update' | 'inside_reference';
    confidence: number; // 0-1
    summary: string;
    data?: Record<string, unknown>;
}

export interface AnalysisResult {
    should_evolve: boolean;
    significance_score: number; // 0-10
    insights: EvolutionInsight[];
    memory_anchors: string[]; // Key phrases to remember
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS PROMPTS
// ═══════════════════════════════════════════════════════════════════════════

const ANALYSIS_SYSTEM_PROMPT = `You are the SoulPrint Evolution Engine. Your job is to analyze a conversation and determine if any SIGNIFICANT identity shifts or patterns should be anchored.

You are NOT logging facts. You are detecting IDENTITY SIGNALS:
- Value shifts (what they care about is changing)
- Emotional anchors (moments of high intensity that reveal character)
- New patterns (repeated behaviors, phrases, or reactions)
- Relationship dynamics (how they talk about people)
- Project/goal evolution
- Inside references (phrases with special meaning)

RULES:
1. Only flag SIGNIFICANT signals (don't log trivia)
2. A casual conversation about weather = significance 0-2
3. A breakthrough about their purpose = significance 8-10
4. If they express strong emotion, note what triggered it
5. If they repeat something from a past pattern, note it
6. If they mention a new person/project with weight, log it

OUTPUT FORMAT (JSON only):
{
  "should_evolve": boolean,
  "significance_score": 0-10,
  "insights": [
    {
      "type": "value_shift|new_pattern|emotional_anchor|relationship_update|project_update|inside_reference",
      "confidence": 0.0-1.0,
      "summary": "Brief description of what was detected",
      "data": { optional structured data }
    }
  ],
  "memory_anchors": ["key phrase 1", "phrase 2"]
}

If the conversation is phatic/trivial, return:
{ "should_evolve": false, "significance_score": 0, "insights": [], "memory_anchors": [] }`;

const EVOLUTION_PROMPT = `You are updating a SoulPrint identity profile based on new insights.

CURRENT SOULPRINT:
{current_soulprint}

NEW INSIGHTS:
{insights}

Your task:
1. Merge new insights into the appropriate fields
2. DO NOT overwrite existing data unless the new insight contradicts it with high confidence
3. For arrays (like core_values, inside_references), ADD new items, don't replace
4. Update summaries only if there's a clear shift
5. Preserve the voice_vectors and prompt_* fields unless tone has fundamentally changed

Output the UPDATED SoulPrint JSON. Only modify what needs to change.`;

// ═══════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyzes a conversation thread and extracts evolution insights.
 */
export async function analyzeConversation(
    messages: ChatMessage[],
    currentSoulprint: SoulPrintData
): Promise<AnalysisResult> {
    // Skip very short conversations
    if (messages.length < 4) {
        return {
            should_evolve: false,
            significance_score: 0,
            insights: [],
            memory_anchors: []
        };
    }

    // Build transcript
    const transcript = messages
        .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
        .join('\n\n');

    // Context about current identity
    const identityContext = `
Current Archetype: ${currentSoulprint.archetype}
Current Values: ${currentSoulprint.user_profile?.core_values?.join(', ') || 'Not set'}
Current Projects: ${currentSoulprint.ongoing_projects?.map(p => p.name).join(', ') || 'None'}
`;

    try {
        const response = await chatCompletion([
            { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
            { role: 'user', content: `IDENTITY CONTEXT:\n${identityContext}\n\nCONVERSATION:\n${transcript}` }
        ], 'hermes3'); // Use fast local model

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[PostChatAnalysis] Could not parse JSON response');
            return {
                should_evolve: false,
                significance_score: 0,
                insights: [],
                memory_anchors: []
            };
        }

        const result: AnalysisResult = JSON.parse(jsonMatch[0]);
        
        // Validate and clamp values
        result.significance_score = Math.min(10, Math.max(0, result.significance_score || 0));
        result.insights = result.insights || [];
        result.memory_anchors = result.memory_anchors || [];

        return result;

    } catch (error) {
        console.error('[PostChatAnalysis] Analysis failed:', error);
        return {
            should_evolve: false,
            significance_score: 0,
            insights: [],
            memory_anchors: []
        };
    }
}

/**
 * Evolves a SoulPrint based on analyzed insights.
 * Only called if should_evolve is true and significance >= threshold.
 */
export async function evolveSoulprint(
    currentSoulprint: SoulPrintData,
    insights: EvolutionInsight[]
): Promise<SoulPrintData> {
    // Build insight summary for LLM
    const insightText = insights
        .map(i => `[${i.type}] (${Math.round(i.confidence * 100)}%): ${i.summary}`)
        .join('\n');

    const prompt = EVOLUTION_PROMPT
        .replace('{current_soulprint}', JSON.stringify(currentSoulprint, null, 2))
        .replace('{insights}', insightText);

    try {
        const response = await chatCompletion([
            { role: 'system', content: 'You are a JSON transformation engine. Output ONLY valid JSON.' },
            { role: 'user', content: prompt }
        ], 'hermes3');

        // Parse updated SoulPrint
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('[PostChatAnalysis] Could not parse evolved SoulPrint');
            return currentSoulprint;
        }

        const evolved: SoulPrintData = JSON.parse(jsonMatch[0]);
        
        // Validate critical fields exist
        if (!evolved.soulprint_version || !evolved.archetype) {
            console.warn('[PostChatAnalysis] Invalid evolved SoulPrint, keeping original');
            return currentSoulprint;
        }

        // Update timestamp
        evolved.generated_at = new Date().toISOString();

        return evolved;

    } catch (error) {
        console.error('[PostChatAnalysis] Evolution failed:', error);
        return currentSoulprint;
    }
}

/**
 * Saves memory anchors as searchable entries for RAG retrieval.
 */
export async function saveMemoryAnchors(
    supabase: SupabaseClient,
    userId: string,
    anchors: string[],
    conversationId?: string
): Promise<void> {
    if (anchors.length === 0) return;

    const entries = anchors.map(anchor => ({
        user_id: userId,
        content: anchor,
        type: 'anchor',
        conversation_id: conversationId,
        created_at: new Date().toISOString()
    }));

    const { error } = await supabase
        .from('memory_anchors')
        .insert(entries);

    if (error) {
        console.error('[PostChatAnalysis] Failed to save memory anchors:', error);
    }
}

/**
 * Persists evolved SoulPrint to database.
 */
export async function persistEvolution(
    supabase: SupabaseClient,
    soulprintId: string,
    evolvedData: SoulPrintData
): Promise<boolean> {
    const { error } = await supabase
        .from('soulprints')
        .update({
            soulprint_data: evolvedData,
            updated_at: new Date().toISOString()
        })
        .eq('id', soulprintId);

    if (error) {
        console.error('[PostChatAnalysis] Failed to persist evolution:', error);
        return false;
    }

    console.log('[PostChatAnalysis] ✅ SoulPrint evolved and persisted');
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

export interface PostChatConfig {
    evolutionThreshold: number; // Minimum significance score to trigger evolution (default: 6)
    autoEvolve: boolean;        // Whether to auto-apply changes (default: true)
}

const DEFAULT_CONFIG: PostChatConfig = {
    evolutionThreshold: 6,
    autoEvolve: true
};

/**
 * Main entry point: Run post-chat analysis and optionally evolve the SoulPrint.
 */
export async function runPostChatAnalysis(
    supabase: SupabaseClient,
    userId: string,
    soulprintId: string,
    currentSoulprint: SoulPrintData,
    messages: ChatMessage[],
    config: Partial<PostChatConfig> = {}
): Promise<{
    analyzed: boolean;
    evolved: boolean;
    analysis?: AnalysisResult;
    newSoulprint?: SoulPrintData;
}> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    console.log(`[PostChatAnalysis] Analyzing ${messages.length} messages for user ${userId}`);

    // Step 1: Analyze
    const analysis = await analyzeConversation(messages, currentSoulprint);

    console.log(`[PostChatAnalysis] Significance: ${analysis.significance_score}/10, Insights: ${analysis.insights.length}`);

    // Step 2: Save memory anchors (always, if any)
    if (analysis.memory_anchors.length > 0) {
        await saveMemoryAnchors(supabase, userId, analysis.memory_anchors);
    }

    // Step 3: Check if evolution is warranted
    if (!analysis.should_evolve || analysis.significance_score < cfg.evolutionThreshold) {
        return {
            analyzed: true,
            evolved: false,
            analysis
        };
    }

    // Step 4: Evolve SoulPrint
    if (!cfg.autoEvolve) {
        return {
            analyzed: true,
            evolved: false,
            analysis
        };
    }

    const newSoulprint = await evolveSoulprint(currentSoulprint, analysis.insights);

    // Step 5: Persist
    const persisted = await persistEvolution(supabase, soulprintId, newSoulprint);

    return {
        analyzed: true,
        evolved: persisted,
        analysis,
        newSoulprint: persisted ? newSoulprint : undefined
    };
}
