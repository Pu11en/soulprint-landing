'use client';

import Link from 'next/link';

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#09090B]/95 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.svg" alt="SoulPrint" className="w-8 h-8" />
            <span className="font-semibold text-lg">SoulPrint</span>
          </Link>
          <Link 
            href="/signup"
            className="px-4 py-2 bg-[#f97415] text-white text-sm font-medium rounded-full hover:bg-orange-600 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="text-center mb-16">
          <p className="text-orange-500 text-sm font-medium uppercase tracking-widest mb-4">Technical White Paper</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">SoulPrint</h1>
          <p className="text-white/50 text-lg">Privacy-First AI Personalization Platform</p>
          <p className="text-white/30 text-sm mt-4">Version 1.0 | January 2026</p>
        </div>

        {/* Executive Summary */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-orange-500">Executive Summary</h2>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <p className="text-white/80 leading-relaxed">
              SoulPrint is a privacy-first AI personalization platform that creates deeply personalized AI assistants 
              by analyzing users' existing conversation history. Unlike traditional AI assistants that start from zero, 
              SoulPrint builds a comprehensive understanding of each user's communication style, interests, knowledge areas, 
              and personality traits—creating an AI that truly knows them.
            </p>
          </div>
        </section>

        {/* The Problem & Solution */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6">The Problem</h2>
          <p className="text-white/70 leading-relaxed mb-8">
            Current AI assistants are generic. Every user gets the same experience, requiring repeated context-setting 
            and explanation. Users spend significant time teaching AI about their preferences, expertise, and communication 
            style—only to lose that context between sessions.
          </p>
          
          <h2 className="text-2xl font-semibold mb-6">The Solution</h2>
          <p className="text-white/70 leading-relaxed">
            SoulPrint inverts this paradigm. By analyzing a user's historical conversations (starting with ChatGPT exports), 
            we construct a rich semantic profile—a "SoulPrint"—that enables the AI to understand who the user is from the 
            very first interaction.
          </p>
        </section>

        {/* Architecture */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-orange-500">Architecture Overview</h2>
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-white/70">{`
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Import    │  │    Chat     │  │  Dashboard  │         │
│  │   Module    │  │   Interface │  │   & Settings│         │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘         │
│         │                │                                  │
│         ▼                ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Client-Side Processing Engine              │   │
│  │  • ZIP extraction  • Conversation parsing            │   │
│  │  • SoulPrint generation  • Privacy filtering         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Memory Enhancement System               │   │
│  │  • Semantic search  • Context injection              │   │
│  │  • Relevance scoring  • Memory synthesis             │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LLM Integration (Claude)                │   │
│  │  • Personality-aware responses                       │   │
│  │  • Style matching  • Knowledge grounding             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Supabase   │  │ Cloudinary  │  │  Vector DB  │         │
│  │  (Auth/Data)│  │  (Media)    │  │ (Embeddings)│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
            `}</pre>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-orange-500">Privacy-First Data Processing</h2>
          
          <div className="bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20 rounded-2xl p-6 mb-6">
            <h3 className="text-green-400 font-semibold mb-3 flex items-center gap-2">
              <span className="text-xl">🔒</span> Key Innovation
            </h3>
            <p className="text-white/80">
              All conversation analysis happens in the user's browser. Raw conversation data never leaves the device.
            </p>
          </div>

          <h3 className="text-xl font-semibold mb-4">What We Store vs. What Stays Local</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
              <h4 className="text-red-400 font-medium mb-3">❌ Never Stored on Server</h4>
              <ul className="space-y-2 text-white/70 text-sm">
                <li>• Raw conversations</li>
                <li>• Conversation content</li>
                <li>• Personal messages</li>
                <li>• Sensitive information</li>
              </ul>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
              <h4 className="text-green-400 font-medium mb-3">✅ Stored (Encrypted)</h4>
              <ul className="space-y-2 text-white/70 text-sm">
                <li>• Extracted interests</li>
                <li>• Communication style</li>
                <li>• Personality traits</li>
                <li>• Semantic embeddings</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SoulPrint Object */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-orange-500">The SoulPrint Object</h2>
          <p className="text-white/70 mb-6">
            A SoulPrint is a structured representation of a user's digital identity:
          </p>
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-white/70">{`interface SoulPrint {
  // Core Identity
  interests: string[];           // Detected topics of interest
  expertise: string[];           // Areas of deep knowledge
  communicationStyle: {
    formality: 'casual' | 'formal' | 'mixed';
    verbosity: 'concise' | 'detailed' | 'varies';
    tone: string[];              // e.g., ['analytical', 'curious']
  };
  
  // AI Persona Configuration
  aiPersona: {
    name: string;
    traits: string[];            // How the AI should behave
    instructions: string;        // Custom system prompt
  };
  
  // Statistics
  stats: {
    totalConversations: number;
    totalMessages: number;
    dateRange: { start: Date; end: Date };
    topTopics: { topic: string; count: number }[];
  };
}`}</pre>
          </div>
        </section>

        {/* Memory System */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-orange-500">Memory-Enhanced Conversations</h2>
          <p className="text-white/70 mb-6">
            When a user sends a message, SoulPrint enhances the AI's response with relevant memories:
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500 font-bold">1</div>
              <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-white/80">User sends message: "What should I do about my startup?"</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500 font-bold">2</div>
              <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-white/80">Semantic search retrieves relevant memories about user's business context</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center text-orange-500 font-bold">3</div>
              <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <p className="text-white/80">Context-enriched request sent to LLM with user's SoulPrint + memories</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 font-bold">✓</div>
              <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-white/80">Personalized response that knows user's specific context</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-orange-500">Technology Stack</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { layer: 'Frontend', tech: 'Next.js 16, React, TypeScript, Tailwind CSS' },
              { layer: 'Backend', tech: 'Next.js API Routes, Edge Functions' },
              { layer: 'Database', tech: 'Supabase (PostgreSQL)' },
              { layer: 'Authentication', tech: 'Supabase Auth' },
              { layer: 'AI/LLM', tech: 'Anthropic Claude' },
              { layer: 'Embeddings', tech: 'OpenAI text-embedding-3-small' },
              { layer: 'Media Storage', tech: 'Cloudinary' },
              { layer: 'Hosting', tech: 'Vercel / Render' },
            ].map((item, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex justify-between items-center">
                <span className="text-white/50 text-sm">{item.layer}</span>
                <span className="text-white font-medium text-sm">{item.tech}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-orange-500">Roadmap</h2>
          <div className="space-y-6">
            <div className="relative pl-8 border-l-2 border-green-500">
              <div className="absolute left-[-9px] top-0 w-4 h-4 bg-green-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-green-400">Phase 1: Foundation ✓</h3>
              <p className="text-white/60 text-sm mt-1">ChatGPT import, client-side processing, memory-enhanced chat</p>
            </div>
            <div className="relative pl-8 border-l-2 border-orange-500">
              <div className="absolute left-[-9px] top-0 w-4 h-4 bg-orange-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-orange-400">Phase 2: Mobile Apps</h3>
              <p className="text-white/60 text-sm mt-1">iOS & Android native apps via App Store</p>
            </div>
            <div className="relative pl-8 border-l-2 border-white/20">
              <div className="absolute left-[-9px] top-0 w-4 h-4 bg-white/20 rounded-full"></div>
              <h3 className="text-lg font-semibold text-white/60">Phase 3: Multi-Source Import</h3>
              <p className="text-white/60 text-sm mt-1">WhatsApp, Telegram, Google Messages, Email</p>
            </div>
            <div className="relative pl-8 border-l-2 border-white/20">
              <div className="absolute left-[-9px] top-0 w-4 h-4 bg-white/20 rounded-full"></div>
              <h3 className="text-lg font-semibold text-white/60">Phase 4: Enterprise</h3>
              <p className="text-white/60 text-sm mt-1">Team SoulPrints, SSO, compliance features</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/[0.06] pt-8 mt-16 text-center">
          <p className="text-white/40 text-sm">© 2026 ArcheForge. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/" className="text-white/50 hover:text-white text-sm transition-colors">Home</Link>
            <Link href="/signup" className="text-white/50 hover:text-white text-sm transition-colors">Sign Up</Link>
            <Link href="/chat" className="text-white/50 hover:text-white text-sm transition-colors">Chat</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
