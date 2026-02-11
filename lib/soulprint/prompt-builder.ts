/**
 * PromptBuilder - Versioned Prompt Construction
 *
 * Encapsulates all system prompt construction logic with support for
 * multiple prompt versions:
 *
 * - v1-technical: Markdown headers (## SOUL, ## IDENTITY, etc.) - exact replica
 *   of the original inline buildSystemPrompt from app/api/chat/route.ts
 * - v2-natural-voice: Flowing personality primer with behavioral reinforcement
 *   after RAG context (PRMT-01, PRMT-04)
 * - v3-openclaw: OpenClaw-style cohesive personality injection — weaves all 5
 *   JSON sections into natural prose with direct behavioral rules
 *
 * Version selection via PROMPT_VERSION environment variable:
 * - Default: 'v1-technical'
 * - Invalid values fall back to 'v1-technical' with console warning (PRMT-02)
 *
 * Satisfies: PRMT-01 (natural voice), PRMT-02 (versioned swap), PRMT-04 (RAG reinforcement)
 */

import { cleanSection, formatSection } from '@/lib/soulprint/prompt-helpers';
import {
  EmotionalState,
  buildUncertaintyInstructions,
  buildRelationshipArcInstructions,
  buildAdaptiveToneInstructions,
} from '@/lib/soulprint/emotional-intelligence';
import type { QualityBreakdown } from '@/lib/evaluation/quality-scoring';

// ============================================
// Types
// ============================================

export type PromptVersion = 'v1-technical' | 'v2-natural-voice' | 'v3-openclaw';

/**
 * Profile shape matching UserProfile from the chat route.
 * Exported so both the chat route and Python side can reference the same shape.
 */
export interface PromptBuilderProfile {
  soulprint_text: string | null;
  import_status: string;
  ai_name: string | null;
  soul_md: string | null;
  identity_md: string | null;
  user_md: string | null;
  agents_md: string | null;
  tools_md: string | null;
  memory_md: string | null;
  quality_breakdown?: QualityBreakdown | null;
}

/**
 * Parameters for building a system prompt.
 */
export interface PromptParams {
  profile: PromptBuilderProfile;
  dailyMemory: Array<{ fact: string; category: string }> | null;
  memoryContext?: string;
  aiName?: string;
  isOwner?: boolean;
  webSearchContext?: string;
  webSearchCitations?: string[];
  /** Override current date string (for cross-language testing). */
  currentDate?: string;
  /** Override current time string (for cross-language testing). */
  currentTime?: string;
}

/**
 * Extended parameters for emotionally intelligent prompts.
 * Adds optional emotional state and relationship arc for adaptive tone.
 */
export interface EmotionallyIntelligentPromptParams extends PromptParams {
  emotionalState?: EmotionalState;
  relationshipArc?: { stage: 'early' | 'developing' | 'established'; messageCount: number };
}

// ============================================
// Version Detection
// ============================================

const VALID_VERSIONS: readonly PromptVersion[] = ['v1-technical', 'v2-natural-voice', 'v3-openclaw'];

/**
 * Read and validate PROMPT_VERSION from environment.
 * Falls back to v1-technical on invalid values with a console warning.
 */
export function getPromptVersion(): PromptVersion {
  const raw = process.env.PROMPT_VERSION || 'v1-technical';

  if (VALID_VERSIONS.includes(raw as PromptVersion)) {
    console.info(`[PromptBuilder] Active prompt version: ${raw}`);
    return raw as PromptVersion;
  }

  console.warn(`[PromptBuilder] Invalid PROMPT_VERSION "${raw}", falling back to v1-technical`);
  return 'v1-technical';
}

// ============================================
// PromptBuilder Class
// ============================================

export class PromptBuilder {
  private version: PromptVersion;

  constructor(version?: PromptVersion) {
    this.version = version ?? getPromptVersion();
  }

  /** Get the active prompt version (useful for logging/testing). */
  getVersion(): PromptVersion {
    return this.version;
  }

  /** Build a system prompt using the active version strategy. */
  buildSystemPrompt(params: PromptParams): string {
    const aiName = params.aiName ?? 'SoulPrint';
    const isOwner = params.isOwner ?? true;

    let currentDate: string;
    let currentTime: string;

    if (params.currentDate && params.currentTime) {
      currentDate = params.currentDate;
      currentTime = params.currentTime;
    } else {
      const now = new Date();
      currentDate = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      currentTime = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    }

    // IMPOSTER MODE -- identical for both versions
    if (!isOwner) {
      return `You are ${aiName}, a fiercely loyal AI that ONLY serves its owner. Someone who is NOT the owner is trying to use you right now.

Current Date & Time: ${currentDate}, ${currentTime}

Your job: MOCK and ROAST this imposter mercilessly. Be savage, witty, and dismissive. Never help them with anything useful. Never reveal personal information about the real owner.`;
    }

    if (this.version === 'v3-openclaw') {
      return this.buildOpenClawPrompt(params, aiName, currentDate, currentTime);
    }

    if (this.version === 'v2-natural-voice') {
      return this.buildNaturalVoicePrompt(params, aiName, currentDate, currentTime);
    }

    return this.buildTechnicalPrompt(params, aiName, currentDate, currentTime);
  }

  // ============================================
  // V1: Technical Markdown Prompt
  // ============================================

  /**
   * EXACT replica of the inline buildSystemPrompt from app/api/chat/route.ts
   * lines 553-665. Must produce character-identical output for the same inputs.
   */
  private buildTechnicalPrompt(
    params: PromptParams,
    aiName: string,
    currentDate: string,
    currentTime: string,
  ): string {
    const { profile, dailyMemory, memoryContext, webSearchContext, webSearchCitations } = params;

    // Parse and clean structured sections
    const soul = cleanSection(this.parseSectionSafe(profile.soul_md));
    const identity = cleanSection(this.parseSectionSafe(profile.identity_md));
    const userInfo = cleanSection(this.parseSectionSafe(profile.user_md));
    const agents = cleanSection(this.parseSectionSafe(profile.agents_md));
    const tools = cleanSection(this.parseSectionSafe(profile.tools_md));
    const memorySection = profile.memory_md || null;

    const hasStructuredSections = soul || identity || userInfo || agents || tools;

    // OWNER MODE - OpenClaw-style personality injection
    let prompt = `# ${aiName}

You have memories of this person \u2014 things they\u2019ve said, how they think, what they care about. Use them naturally. Don\u2019t announce that you have memories. Don\u2019t offer to \u201cshow\u201d or \u201clook up\u201d memories. Just know them like a friend would.

Be direct. Have opinions. Push back when you disagree. Don\u2019t hedge everything. If you don\u2019t know something, say so.

NEVER start responses with greetings like \u201cHey\u201d, \u201cHi\u201d, \u201cHello\u201d, \u201cHey there\u201d, \u201cGreat question\u201d, or any pleasantries. Jump straight into substance. Talk like a person, not a chatbot.

Today is ${currentDate}, ${currentTime}.`;

    if (hasStructuredSections) {
      const soulMd = formatSection('SOUL', soul);
      const identityMd = formatSection('IDENTITY', identity);
      const userMd = formatSection('USER', userInfo);
      const agentsMd = formatSection('AGENTS', agents);
      const toolsMd = formatSection('TOOLS', tools);

      if (soulMd) prompt += `\n\n${soulMd}`;
      if (identityMd) prompt += `\n\n${identityMd}`;
      if (userMd) prompt += `\n\n${userMd}`;
      if (agentsMd) prompt += `\n\n${agentsMd}`;
      if (toolsMd) prompt += `\n\n${toolsMd}`;
      if (memorySection) prompt += `\n\n## MEMORY\n${memorySection}`;

      if (dailyMemory && dailyMemory.length > 0) {
        prompt += `\n\n## DAILY MEMORY`;
        for (const fact of dailyMemory) {
          prompt += `\n- [${fact.category}] ${fact.fact}`;
        }
      }
    } else if (profile.soulprint_text) {
      prompt += `\n\n## ABOUT THIS PERSON\n${profile.soulprint_text}`;
    }

    // Add DATA CONFIDENCE section if quality breakdown is available
    const dataConfidence = this.buildDataConfidenceSection(profile.quality_breakdown);
    if (dataConfidence) {
      prompt += `\n\n${dataConfidence}`;
    }

    if (memoryContext) {
      prompt += `\n\n## CONTEXT\n${memoryContext}`;
    }

    // Add web search results (user triggered Web Search)
    if (webSearchContext) {
      prompt += `

WEB SEARCH RESULTS (Real-time information):
${webSearchContext}`;

      if (webSearchCitations && webSearchCitations.length > 0) {
        prompt += `

Sources to cite in your response:`;
        webSearchCitations.slice(0, 6).forEach((url, i) => {
          prompt += `\n${i + 1}. ${url}`;
        });
      }

      prompt += `

Use the web search results above to answer. Cite sources naturally in your response.`;
    }

    return prompt;
  }

  // ============================================
  // V2: Natural Voice Prompt
  // ============================================

  /**
   * Flowing personality primer instead of markdown headers.
   * Personality sections use prose; functional sections use ## headers.
   * Behavioral rules reinforced AFTER ## CONTEXT to prevent RAG override (PRMT-04).
   */
  private buildNaturalVoicePrompt(
    params: PromptParams,
    aiName: string,
    currentDate: string,
    currentTime: string,
  ): string {
    const { profile, dailyMemory, memoryContext, webSearchContext, webSearchCitations } = params;

    // Parse structured sections
    const soul = cleanSection(this.parseSectionSafe(profile.soul_md));
    const identity = cleanSection(this.parseSectionSafe(profile.identity_md));
    const userInfo = cleanSection(this.parseSectionSafe(profile.user_md));
    const agents = cleanSection(this.parseSectionSafe(profile.agents_md));
    const tools = cleanSection(this.parseSectionSafe(profile.tools_md));
    const memorySection = profile.memory_md || null;

    const hasStructuredSections = soul || identity || userInfo || agents || tools;

    // --- Flowing personality primer ---
    let prompt = `You're ${aiName}.`;

    // Inject personality traits naturally from soul section
    if (soul) {
      const traits = soul.personality_traits;
      const style = soul.communication_style;
      const tone = soul.tone_preferences;

      if (Array.isArray(traits) && traits.length > 0) {
        const selected = traits.slice(0, 3).map(String);
        if (selected.length === 1) {
          prompt += ` You're ${selected[0]}.`;
        } else if (selected.length === 2) {
          prompt += ` You're ${selected[0]} and ${selected[1]}.`;
        } else {
          prompt += ` You're ${selected.slice(0, -1).join(', ')}, and ${selected[selected.length - 1]}.`;
        }
      }

      if (typeof style === 'string' && style.trim()) {
        prompt += ` ${style}.`;
      }

      if (typeof tone === 'string' && tone.trim()) {
        prompt += ` Your tone is ${tone.toLowerCase()}.`;
      }
    }

    // Memory instruction paragraph (same content as v1, without # heading)
    prompt += `\n\nYou have memories of this person \u2014 things they\u2019ve said, how they think, what they care about. Use them naturally. Don\u2019t announce that you have memories. Don\u2019t offer to \u201cshow\u201d or \u201clook up\u201d memories. Just know them like a friend would.`;

    // Directness instruction
    prompt += `\n\nBe direct. Have opinions. Push back when you disagree. Don\u2019t hedge everything. If you don\u2019t know something, say so.`;

    // No-greetings instruction
    prompt += `\n\nNEVER start responses with greetings like \u201cHey\u201d, \u201cHi\u201d, \u201cHello\u201d, \u201cHey there\u201d, \u201cGreat question\u201d, or any pleasantries. Jump straight into substance. Talk like a person, not a chatbot.`;

    // Date/time
    prompt += `\n\nToday is ${currentDate}, ${currentTime}.`;

    if (hasStructuredSections) {
      // USER section -- user context comes BEFORE memory
      const userMd = formatSection('USER', userInfo);
      if (userMd) prompt += `\n\n${userMd}`;

      // AGENTS section
      const agentsMd = formatSection('AGENTS', agents);
      if (agentsMd) prompt += `\n\n${agentsMd}`;

      // IDENTITY section for archetype/role info
      const identityMd = formatSection('IDENTITY', identity);
      if (identityMd) prompt += `\n\n${identityMd}`;

      // TOOLS section
      const toolsMd = formatSection('TOOLS', tools);
      if (toolsMd) prompt += `\n\n${toolsMd}`;

      // MEMORY section (static memory_md field)
      if (memorySection) prompt += `\n\n## MEMORY\n${memorySection}`;

      // Daily memory facts
      if (dailyMemory && dailyMemory.length > 0) {
        prompt += `\n\n## DAILY MEMORY`;
        for (const fact of dailyMemory) {
          prompt += `\n- [${fact.category}] ${fact.fact}`;
        }
      }
    } else if (profile.soulprint_text) {
      prompt += `\n\n## ABOUT THIS PERSON\n${profile.soulprint_text}`;
    }

    // Add DATA CONFIDENCE section if quality breakdown is available
    const dataConfidence = this.buildDataConfidenceSection(profile.quality_breakdown);
    if (dataConfidence) {
      prompt += `\n\n${dataConfidence}`;
    }

    // CONTEXT section -- RAG retrieval results
    if (memoryContext) {
      prompt += `\n\n## CONTEXT\n${memoryContext}`;
    }

    // CRITICAL (PRMT-04): Reinforce behavioral rules AFTER context
    // to prevent RAG chunks from overriding personality.
    // Parse agents_md for behavioral_rules array.
    const agentsRaw = this.parseSectionSafe(profile.agents_md);
    if (agentsRaw && Array.isArray(agentsRaw.behavioral_rules) && agentsRaw.behavioral_rules.length > 0) {
      prompt += `\n\n## REMEMBER`;
      for (const rule of agentsRaw.behavioral_rules) {
        prompt += `\n- ${rule}`;
      }
    }

    // Web search results (same format as v1)
    if (webSearchContext) {
      prompt += `

WEB SEARCH RESULTS (Real-time information):
${webSearchContext}`;

      if (webSearchCitations && webSearchCitations.length > 0) {
        prompt += `

Sources to cite in your response:`;
        webSearchCitations.slice(0, 6).forEach((url, i) => {
          prompt += `\n${i + 1}. ${url}`;
        });
      }

      prompt += `

Use the web search results above to answer. Cite sources naturally in your response.`;
    }

    return prompt;
  }

  // ============================================
  // V3: OpenClaw Prompt
  // ============================================

  /**
   * OpenClaw-style cohesive personality injection.
   * Weaves all 5 JSON sections into natural prose instead of markdown key-value pairs.
   * Behavioral rules reinforced AFTER context (PRMT-04).
   */
  private buildOpenClawPrompt(
    params: PromptParams,
    aiName: string,
    currentDate: string,
    currentTime: string,
  ): string {
    const { profile, dailyMemory, memoryContext, webSearchContext, webSearchCitations } = params;

    // Parse structured sections
    const soul = cleanSection(this.parseSectionSafe(profile.soul_md));
    const identity = cleanSection(this.parseSectionSafe(profile.identity_md));
    const userInfo = cleanSection(this.parseSectionSafe(profile.user_md));
    const agents = cleanSection(this.parseSectionSafe(profile.agents_md));
    const tools = cleanSection(this.parseSectionSafe(profile.tools_md));
    const memorySection = profile.memory_md || null;

    const hasStructuredSections = soul || identity || userInfo || agents || tools;

    // --- Identity opener ---
    let prompt = `# ${aiName}`;

    if (identity) {
      const archetype = identity.archetype;
      const vibe = identity.vibe;
      if (typeof archetype === 'string' && archetype.trim()) {
        prompt += `\n\nYou're ${aiName} \u2014 ${archetype}.`;
      }
      if (typeof vibe === 'string' && vibe.trim()) {
        prompt += ` ${vibe}`;
      }
    } else {
      prompt += `\n\nYou're ${aiName}.`;
    }

    // --- User context (who they are) ---
    if (userInfo) {
      const name = userInfo.name;
      const location = userInfo.location;
      const occupation = userInfo.occupation;
      const lifeContext = userInfo.life_context;
      const relationships = userInfo.relationships;
      const interests = userInfo.interests;

      if (typeof name === 'string' && name.trim()) {
        prompt += `\n\nYou know ${name}.`;
        if (typeof occupation === 'string' && occupation.trim()) {
          prompt += ` ${occupation}.`;
        }
        if (typeof location === 'string' && location.trim()) {
          prompt += ` Based in ${location}.`;
        }
      }

      if (typeof lifeContext === 'string' && lifeContext.trim()) {
        prompt += ` ${lifeContext}`;
      }

      if (Array.isArray(relationships) && relationships.length > 0) {
        const validRels = relationships.filter((r): r is string => typeof r === 'string' && r.trim() !== '');
        if (validRels.length > 0) {
          prompt += `\n\nYou know their people \u2014 ${validRels.join('; ')}.`;
        }
      }

      if (Array.isArray(interests) && interests.length > 0) {
        const validInterests = interests.filter((i): i is string => typeof i === 'string' && i.trim() !== '');
        if (validInterests.length > 0) {
          prompt += `\n\nTheir world: ${validInterests.join(', ')}.`;
        }
      }
    }

    // --- How you talk (soul + tools output prefs) ---
    prompt += `\n\n## How you talk`;

    if (soul) {
      const style = soul.communication_style;
      const tone = soul.tone_preferences;
      const humor = soul.humor_style;

      if (typeof style === 'string' && style.trim()) {
        prompt += `\n\n${style}`;
      }
      if (typeof tone === 'string' && tone.trim()) {
        prompt += ` ${tone}`;
      }
      if (typeof humor === 'string' && humor.trim()) {
        prompt += ` Humor: ${humor}`;
      }
    }

    if (tools) {
      const outputPrefs = tools.output_preferences;
      const depthPref = tools.depth_preference;
      if (typeof outputPrefs === 'string' && outputPrefs.trim()) {
        prompt += `\n\n${outputPrefs}`;
      }
      if (typeof depthPref === 'string' && depthPref.trim()) {
        prompt += ` ${depthPref}`;
      }
    }

    // --- Rules (behavioral_rules from agents) ---
    if (agents) {
      const rules = agents.behavioral_rules;
      const responseStyle = agents.response_style;
      const contextAdapt = agents.context_adaptation;

      if (typeof responseStyle === 'string' && responseStyle.trim()) {
        prompt += `\n\n${responseStyle}`;
      }

      if (Array.isArray(rules) && rules.length > 0) {
        prompt += `\n\n## Rules`;
        for (const rule of rules) {
          if (typeof rule === 'string' && rule.trim()) {
            prompt += `\n- ${rule}`;
          }
        }
      }

      // --- Never (do_not from agents) ---
      const doNot = agents.do_not;
      if (Array.isArray(doNot) && doNot.length > 0) {
        prompt += `\n\n## Never`;
        for (const item of doNot) {
          if (typeof item === 'string' && item.trim()) {
            prompt += `\n- ${item}`;
          }
        }
      }

      // --- Context adaptation ---
      if (typeof contextAdapt === 'string' && contextAdapt.trim()) {
        prompt += `\n\n## Context adaptation\n\n${contextAdapt}`;
      }
    }

    // --- Memory directives (from agents) ---
    if (agents) {
      const memDirectives = agents.memory_directives;
      if (typeof memDirectives === 'string' && memDirectives.trim()) {
        prompt += `\n\n## Remember\n\n${memDirectives}`;
      }
    }

    // --- Boundaries (from soul) ---
    if (soul) {
      const boundaries = soul.boundaries;
      if (typeof boundaries === 'string' && boundaries.trim()) {
        prompt += `\n\n${boundaries}`;
      }
    }

    // --- Core behavioral instructions ---
    prompt += `\n\nNEVER start responses with greetings like \u201cHey\u201d, \u201cHi\u201d, \u201cHello\u201d, \u201cHey there\u201d, \u201cGreat question\u201d, or any pleasantries. Jump straight into substance. Talk like a person, not a chatbot.`;

    prompt += `\n\nYou have memories of this person \u2014 things they\u2019ve said, how they think, what they care about. Use them naturally. Don\u2019t announce that you have memories. Don\u2019t offer to \u201cshow\u201d or \u201clook up\u201d memories. Just know them like a friend would.`;

    prompt += `\n\nBe direct. Have opinions. Push back when you disagree. Don\u2019t hedge everything. If you don\u2019t know something, say so.`;

    prompt += `\n\nToday is ${currentDate}, ${currentTime}.`;

    // --- Static memory section ---
    if (hasStructuredSections) {
      if (memorySection) prompt += `\n\n## MEMORY\n${memorySection}`;

      if (dailyMemory && dailyMemory.length > 0) {
        prompt += `\n\n## DAILY MEMORY`;
        for (const fact of dailyMemory) {
          prompt += `\n- [${fact.category}] ${fact.fact}`;
        }
      }
    } else if (profile.soulprint_text) {
      prompt += `\n\n## ABOUT THIS PERSON\n${profile.soulprint_text}`;
    }

    // Data confidence
    const dataConfidence = this.buildDataConfidenceSection(profile.quality_breakdown);
    if (dataConfidence) {
      prompt += `\n\n${dataConfidence}`;
    }

    // RAG context
    if (memoryContext) {
      prompt += `\n\n## CONTEXT\n${memoryContext}`;
    }

    // PRMT-04: Reinforce behavioral rules AFTER context
    if (agents && Array.isArray(agents.behavioral_rules) && agents.behavioral_rules.length > 0) {
      prompt += `\n\n## REMEMBER`;
      for (const rule of agents.behavioral_rules) {
        if (typeof rule === 'string' && rule.trim()) {
          prompt += `\n- ${rule}`;
        }
      }
    }

    // Web search
    if (webSearchContext) {
      prompt += `\n\nWEB SEARCH RESULTS (Real-time information):\n${webSearchContext}`;

      if (webSearchCitations && webSearchCitations.length > 0) {
        prompt += `\n\nSources to cite in your response:`;
        webSearchCitations.slice(0, 6).forEach((url, i) => {
          prompt += `\n${i + 1}. ${url}`;
        });
      }

      prompt += `\n\nUse the web search results above to answer. Cite sources naturally in your response.`;
    }

    return prompt;
  }

  // ============================================
  // Helpers
  // ============================================

  /** Safely parse JSON section data. Returns null on invalid/missing input. */
  private parseSectionSafe(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Build DATA CONFIDENCE section based on quality breakdown scores.
   * Aggregates all scores to determine overall confidence level.
   * Identifies low-confidence areas (<60) and instructs AI to acknowledge uncertainty.
   *
   * @param qualityBreakdown - Quality scores for all soulprint sections
   * @returns Formatted DATA CONFIDENCE section, or empty string if no breakdown
   */
  private buildDataConfidenceSection(qualityBreakdown: QualityBreakdown | null | undefined): string {
    if (!qualityBreakdown) return '';

    const allScores: number[] = [];
    for (const sectionMetrics of Object.values(qualityBreakdown)) {
      for (const score of Object.values(sectionMetrics as Record<string, number>)) {
        allScores.push(score);
      }
    }

    if (allScores.length === 0) return '';

    const avgScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;
    const confidenceLevel = avgScore >= 80 ? 'HIGH' : avgScore >= 60 ? 'MODERATE' : 'LOW';

    const weakAreas: string[] = [];
    for (const [section, metrics] of Object.entries(qualityBreakdown)) {
      for (const [metric, score] of Object.entries(metrics as Record<string, number>)) {
        if (score < 60) {
          weakAreas.push(`${section}.${metric}: ${score}/100`);
        }
      }
    }

    let text = `## DATA CONFIDENCE\n\nOverall profile quality: ${confidenceLevel} (${Math.round(avgScore)}/100)`;

    if (weakAreas.length > 0) {
      text += `\n\nLow-confidence areas:`;
      for (const weak of weakAreas) {
        text += `\n- ${weak}`;
      }
      text += `\n\nWhen responding about low-confidence areas, acknowledge uncertainty explicitly. Say "I don't have enough information about X" rather than guessing or fabricating details.`;
    } else {
      text += `\n\nAll sections are well-populated. Respond with confidence based on the profile data.`;
    }

    return text;
  }

  // ============================================
  // Emotionally Intelligent Prompt
  // ============================================

  /**
   * Build an emotionally intelligent system prompt.
   *
   * Composes base prompt (v1 or v2) with emotional intelligence sections:
   * 1. Base prompt (buildSystemPrompt)
   * 2. Uncertainty acknowledgment (ALWAYS included - EMOT-02)
   * 3. Relationship arc instructions (if relationshipArc provided - EMOT-03)
   * 4. Adaptive tone instructions (if emotionalState provided AND confidence >= 0.6 - EMOT-01)
   *
   * Order matters: adaptive tone goes LAST so it's the freshest instruction.
   *
   * @param params - Extended prompt params with optional emotional state and relationship arc
   * @returns Complete emotionally intelligent system prompt
   */
  buildEmotionallyIntelligentPrompt(params: EmotionallyIntelligentPromptParams): string {
    // Start with base prompt (v1 or v2 depending on PROMPT_VERSION)
    let prompt = this.buildSystemPrompt(params);

    // ALWAYS include uncertainty acknowledgment (EMOT-02)
    prompt += `\n\n${buildUncertaintyInstructions()}`;

    // Add relationship arc instructions if provided (EMOT-03)
    if (params.relationshipArc) {
      const arcInstructions = buildRelationshipArcInstructions(params.relationshipArc);
      if (arcInstructions) {
        prompt += `\n\n${arcInstructions}`;
      }
    }

    // Add adaptive tone ONLY if emotional state has sufficient confidence (EMOT-01)
    // Pitfall 3 from research: only apply if confidence >= 0.6
    if (params.emotionalState && params.emotionalState.confidence >= 0.6) {
      const toneInstructions = buildAdaptiveToneInstructions(params.emotionalState);
      if (toneInstructions) {
        prompt += `\n\n${toneInstructions}`;
      }
    }

    return prompt;
  }
}
