// SoulPrint Types

export interface SoulPrintPillar {
    summary: string;
    markers?: string[];
    ai_instruction: string;
    // Specific marker types (normalized to 'markers' for consistency)
    voice_markers?: string[];
    emotional_markers?: string[];
    decision_markers?: string[];
    identity_markers?: string[];
    processing_markers?: string[];
    conflict_markers?: string[];
}

export interface SoulPrintPillars {
    communication_style: SoulPrintPillar;
    emotional_alignment: SoulPrintPillar;
    decision_making: SoulPrintPillar;
    social_cultural: SoulPrintPillar;
    cognitive_processing: SoulPrintPillar;
    assertiveness_conflict: SoulPrintPillar;
}

// Voice & Style Definition
export interface VoiceVectors {
    cadence_speed: 'rapid' | 'moderate' | 'deliberate';
    tone_warmth: 'cold/analytical' | 'neutral' | 'warm/empathetic';
    sentence_structure: 'fragmented' | 'balanced' | 'complex';
    emoji_usage: 'none' | 'minimal' | 'liberal';
    sign_off_style: 'none' | 'casual' | 'signature';
}

export interface SoulPrintData {
    // Identity
    soulprint_version: string;
    generated_at: string;
    archetype: string;
    identity_signature: string;
    name?: string;
    user_name?: string;  // User's actual name for personalization

    // Expanded L2 Schema Data (Optional for now)
    user_profile?: {
        legacy_anchors?: string[];
        core_values?: string[];
        motivations?: string[];
        frustrations?: string[];
    };
    inside_references?: Array<{
        keyword: string;
        meaning: string;
        usage_context?: string;
    }>;
    ongoing_projects?: Array<{
        name: string;
        status: string;
        context: string;
    }>;

    // Voice & Style
    voice_vectors: VoiceVectors;
    sign_off: string;       // Actual string value (e.g. "Adios")

    // Structured data
    pillars: SoulPrintPillars;
    flinch_warnings: string[];

    // Tiered prompts (for efficient chat usage)
    prompt_core: string;      // ~50 words - archetype + identity essence  
    prompt_pillars: string;   // ~150 words - 6 ai_instructions combined
    prompt_full: string;      // ~500 words - comprehensive companion prompt

    // Legacy (keep for backwards compatibility)
    full_system_prompt?: string;
}

export interface QuestionnaireAnswers {
    // Sliders (0-100)
    s1: number; s2: number; s3: number;
    s4: number; s5: number; s6: number;
    s7: number; s8: number; s9: number;
    s10: number; s11: number; s12: number;
    s13: number; s14: number; s15: number;
    s16: number; s17: number; s18: number;

    // Text responses
    q1: string; q2: string; q3: string;
    q4: string; q5: string; q6: string;
    q7: string; q8: string; q9: string;
    q10: string; q11: string; q12: string;
    q13: string; q14: string; q15: string;
    q16: string; q17: string; q18: string;

    // Optional voice response
    v1?: string;

    // Metadata
    user_id?: string;
    user_name?: string;  // User's actual name for personalization
}
