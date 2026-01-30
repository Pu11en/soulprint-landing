/**
 * Client-side Soulprint Generator
 * Runs entirely in the browser - no server upload needed
 */

import JSZip from 'jszip';

export interface ConversationChunk {
  id: string;
  title: string;
  content: string;
  messageCount: number;
  createdAt: string;
  isRecent: boolean;
  chunkIndex?: number;    // 0-based index for multi-chunk conversations
  totalChunks?: number;   // Total chunks for this conversation
}

export interface ClientSoulprintResult {
  soulprint: ClientSoulprint;
  conversationChunks: ConversationChunk[];
}

export interface ClientSoulprint {
  writingStyle: {
    formality: 'casual' | 'balanced' | 'formal';
    verbosity: 'concise' | 'balanced' | 'verbose';
    avgMessageLength: number;
  };
  personality: {
    traits: string[];
    communicationStyle: string;
  };
  interests: string[];
  facts: string[];
  relationships: Array<{ name: string; context: string }>;
  aiPersona: {
    tone: string;
    style: string;
    humor: 'none' | 'light' | 'frequent';
    traits: string[];
    avoid: string[];
    soulMd: string;
  };
  stats: {
    totalConversations: number;
    totalMessages: number;
    dateRange: { earliest: string; latest: string };
  };
}

interface ChatGPTMessage {
  id: string;
  author: { role: string };
  content: { parts?: string[]; text?: string };
  create_time?: number;
}

interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, { message?: ChatGPTMessage; children: string[]; parent?: string }>;
  current_node?: string;
}

/**
 * Process a ZIP file and generate soulprint + conversation chunks client-side
 */
export async function generateClientSoulprint(
  file: File,
  onProgress?: (stage: string, percent: number) => void
): Promise<ClientSoulprintResult> {
  onProgress?.('Reading ZIP...', 5);
  
  const zip = await JSZip.loadAsync(file);
  
  onProgress?.('Extracting conversations...', 15);
  
  const conversationsFile = zip.file('conversations.json');
  if (!conversationsFile) {
    throw new Error('conversations.json not found in ZIP');
  }
  
  const conversationsJson = await conversationsFile.async('string');
  
  onProgress?.('Parsing conversations...', 30);
  
  const rawConversations: ChatGPTConversation[] = JSON.parse(conversationsJson);
  
  onProgress?.('Analyzing patterns...', 50);
  
  // Sort by date, take sample for soulprint analysis
  const sorted = rawConversations.sort((a, b) => b.update_time - a.update_time);
  const recent = sorted.slice(0, 100);
  const older = sorted.slice(100);
  const randomSample = sampleArray(older, 200);
  const sampleConvos = [...recent, ...randomSample];
  
  // Extract user messages for analysis
  const userMessages: string[] = [];
  for (const convo of sampleConvos) {
    const messages = extractMessages(convo);
    const userMsgs = messages
      .filter(m => m.role === 'user')
      .slice(0, 20)
      .map(m => m.content);
    userMessages.push(...userMsgs);
  }
  
  onProgress?.('Detecting writing style...', 60);
  
  const writingStyle = analyzeWritingStyle(userMessages);
  const interests = extractInterests(userMessages);
  const facts = extractFacts(userMessages);
  const relationships = extractRelationships(userMessages);
  const personality = derivePersonality(writingStyle, userMessages);
  
  onProgress?.('Generating AI persona...', 70);
  
  const aiPersona = generateAIPersona(writingStyle, personality, userMessages);
  
  onProgress?.('Extracting conversation chunks...', 80);
  
  // Extract ALL conversation chunks with smart chunking for better recall
  // Smaller overlapping chunks enable more precise vector search
  const conversationChunks: ConversationChunk[] = [];
  const totalConvos = sorted.length;
  
  for (let i = 0; i < totalConvos; i++) {
    const convo = sorted[i];
    const messages = extractMessages(convo);
    if (messages.length === 0) continue;
    
    const createdAt = new Date(convo.create_time * 1000);
    const title = convo.title || 'Untitled';
    
    // Use smart chunking for better vector search recall
    const chunks = chunkConversation(messages, title);
    
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      conversationChunks.push({
        id: chunks.length > 1 ? `${convo.id}-chunk-${chunkIdx}` : convo.id,
        title,
        content: chunks[chunkIdx].content,
        messageCount: chunks[chunkIdx].messageCount,
        createdAt: createdAt.toISOString(),
        isRecent: false,
        chunkIndex: chunkIdx,
        totalChunks: chunks.length,
      });
    }
    
    // Update progress during chunk extraction for large exports
    if (i % 100 === 0 && totalConvos > 100) {
      const chunkProgress = 80 + ((i / totalConvos) * 15); // 80-95% during chunking
      onProgress?.(`Extracting conversations (${i}/${totalConvos})...`, Math.round(chunkProgress));
    }
  }
  
  // Calculate stats
  const allDates = rawConversations.map(c => c.create_time * 1000).filter(d => d > 0);
  const totalMessages = rawConversations.reduce((sum, c) => {
    return sum + Object.values(c.mapping).filter(n => n.message).length;
  }, 0);
  
  onProgress?.('Done!', 100);
  
  const soulprint: ClientSoulprint = {
    writingStyle,
    personality,
    interests,
    facts,
    relationships,
    aiPersona,
    stats: {
      totalConversations: rawConversations.length,
      totalMessages,
      dateRange: {
        earliest: allDates.length ? new Date(Math.min(...allDates)).toISOString() : new Date().toISOString(),
        latest: allDates.length ? new Date(Math.max(...allDates)).toISOString() : new Date().toISOString(),
      },
    },
  };
  
  return { soulprint, conversationChunks };
}

function extractMessages(convo: ChatGPTConversation): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  
  // Find root
  let rootId: string | undefined;
  for (const [id, node] of Object.entries(convo.mapping)) {
    if (!node.parent || !convo.mapping[node.parent]) {
      rootId = id;
      break;
    }
  }
  if (!rootId) return messages;
  
  // Build path to current node
  const targetPath = new Set<string>();
  if (convo.current_node) {
    let nodeId: string | undefined = convo.current_node;
    while (nodeId && convo.mapping[nodeId]) {
      targetPath.add(nodeId);
      nodeId = convo.mapping[nodeId].parent;
    }
  }
  
  // Traverse
  function traverse(nodeId: string) {
    const node = convo.mapping[nodeId];
    if (!node) return;
    
    if (node.message) {
      const msg = node.message;
      const content = msg.content?.text || msg.content?.parts?.filter((p): p is string => typeof p === 'string').join('\n') || '';
      if (content.trim() && msg.author.role !== 'system' && msg.author.role !== 'tool') {
        messages.push({ role: msg.author.role, content: content.trim() });
      }
    }
    
    if (node.children.length > 0) {
      const next = node.children.find(c => targetPath.has(c)) || node.children[0];
      traverse(next);
    }
  }
  
  traverse(rootId);
  return messages;
}

function analyzeWritingStyle(messages: string[]) {
  if (messages.length === 0) {
    return { formality: 'balanced' as const, verbosity: 'balanced' as const, avgMessageLength: 0 };
  }
  
  const lengths = messages.map(m => m.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  
  const formalIndicators = ['please', 'thank you', 'would you', 'could you', 'kindly'];
  const casualIndicators = ['hey', 'yo', 'gonna', 'wanna', 'lol', 'lmao', 'haha'];
  
  let formalScore = 0;
  let casualScore = 0;
  const combinedText = messages.join(' ').toLowerCase();
  
  for (const ind of formalIndicators) if (combinedText.includes(ind)) formalScore++;
  for (const ind of casualIndicators) if (combinedText.includes(ind)) casualScore++;
  
  return {
    formality: (formalScore > casualScore + 2 ? 'formal' : casualScore > formalScore + 2 ? 'casual' : 'balanced') as 'casual' | 'balanced' | 'formal',
    verbosity: (avgLength > 200 ? 'verbose' : avgLength < 50 ? 'concise' : 'balanced') as 'concise' | 'balanced' | 'verbose',
    avgMessageLength: Math.round(avgLength),
  };
}

function extractInterests(messages: string[]): string[] {
  const topicIndicators: Record<string, string[]> = {
    'technology': ['code', 'programming', 'software', 'app', 'api', 'tech'],
    'business': ['startup', 'company', 'revenue', 'growth', 'market', 'product'],
    'design': ['design', 'ui', 'ux', 'visual', 'figma'],
    'ai': ['ai', 'gpt', 'machine learning', 'llm', 'model'],
    'fitness': ['workout', 'gym', 'exercise', 'fitness'],
    'music': ['music', 'song', 'album', 'spotify'],
    'finance': ['invest', 'stock', 'crypto', 'money'],
    'gaming': ['game', 'gaming', 'steam', 'console'],
    'productivity': ['productivity', 'notion', 'todo', 'workflow'],
  };
  
  const combinedText = messages.join(' ').toLowerCase();
  const interests: Array<{ topic: string; score: number }> = [];
  
  for (const [topic, keywords] of Object.entries(topicIndicators)) {
    let score = 0;
    for (const kw of keywords) {
      const matches = combinedText.match(new RegExp(`\\b${kw}\\b`, 'gi'));
      score += matches?.length || 0;
    }
    if (score > 2) interests.push({ topic, score });
  }
  
  return interests.sort((a, b) => b.score - a.score).slice(0, 8).map(i => i.topic);
}

function extractFacts(messages: string[]): string[] {
  const facts: string[] = [];
  const patterns = [
    /i (?:work|am working) (?:at|for) ([^,.]+)/gi,
    /i(?:'m| am) (?:a|an) ([^,.]+(?:developer|designer|engineer|manager|founder))/gi,
    /i live in ([^,.]+)/gi,
    /i(?:'m| am) building ([^,.]+)/gi,
  ];
  
  const seen = new Set<string>();
  for (const msg of messages.slice(0, 500)) {
    for (const pattern of patterns) {
      const matches = msg.matchAll(pattern);
      for (const match of matches) {
        const fact = match[0].trim();
        const normalized = fact.toLowerCase();
        if (!seen.has(normalized) && fact.length > 10 && fact.length < 200) {
          seen.add(normalized);
          facts.push(fact);
        }
      }
    }
  }
  
  return facts.slice(0, 20);
}

function extractRelationships(messages: string[]): Array<{ name: string; context: string }> {
  const patterns = [
    { regex: /my (?:wife|husband) ([A-Z][a-z]+)/g, context: 'spouse' },
    { regex: /my (?:girlfriend|boyfriend|partner) ([A-Z][a-z]+)/g, context: 'partner' },
    { regex: /my (?:friend|buddy) ([A-Z][a-z]+)/g, context: 'friend' },
    { regex: /my (?:boss|manager) ([A-Z][a-z]+)/g, context: 'manager' },
  ];
  
  const relationships: Record<string, { name: string; context: string }> = {};
  const combinedText = messages.join(' ');
  
  for (const pattern of patterns) {
    const matches = combinedText.matchAll(pattern.regex);
    for (const match of matches) {
      const name = match[1] || pattern.context;
      relationships[name.toLowerCase()] = { name, context: pattern.context };
    }
  }
  
  return Object.values(relationships).slice(0, 10);
}

function derivePersonality(style: ReturnType<typeof analyzeWritingStyle>, messages: string[]) {
  const traits: string[] = [];
  if (style.formality === 'casual') traits.push('approachable');
  if (style.formality === 'formal') traits.push('professional');
  if (style.verbosity === 'concise') traits.push('direct');
  if (style.verbosity === 'verbose') traits.push('thorough');
  
  const questionCount = messages.filter(m => m.includes('?')).length;
  if (questionCount > messages.length * 0.4) traits.push('curious');
  
  return {
    traits: traits.slice(0, 5),
    communicationStyle: style.formality === 'formal' ? 'Structured and professional' : 
                        style.formality === 'casual' ? 'Relaxed and conversational' : 'Balanced and adaptable',
  };
}

function generateAIPersona(
  style: ReturnType<typeof analyzeWritingStyle>,
  personality: ReturnType<typeof derivePersonality>,
  messages: string[]
) {
  const humorIndicators = ['lol', 'haha', 'lmao', '😂'];
  const combinedText = messages.join(' ').toLowerCase();
  const humorCount = humorIndicators.reduce((sum, ind) => sum + (combinedText.match(new RegExp(ind, 'g'))?.length || 0), 0);
  const humorRatio = humorCount / messages.length;
  const humor = humorRatio > 0.15 ? 'frequent' : humorRatio > 0.05 ? 'light' : 'none';
  
  const traits: string[] = [];
  if (style.formality === 'casual') traits.push('relaxed', 'approachable');
  if (style.formality === 'formal') traits.push('professional');
  if (style.verbosity === 'concise') traits.push('direct', 'efficient');
  if (humor !== 'none') traits.push('witty');
  
  const avoid: string[] = [];
  if (style.verbosity === 'concise') avoid.push('long introductions', 'unnecessary filler');
  if (style.formality === 'casual') avoid.push('corporate speak');
  avoid.push('sycophantic praise', '"Great question!"');
  
  const tone = [
    style.formality === 'casual' ? 'casual' : style.formality === 'formal' ? 'professional' : null,
    style.verbosity === 'concise' ? 'direct' : null,
    humor !== 'none' ? 'friendly' : null,
  ].filter(Boolean).join(' and ') || 'balanced';
  
  const soulMd = `# SOUL.md — AI Persona

**Tone:** ${tone}
**Style:** ${style.verbosity === 'concise' ? 'concise, no fluff' : style.verbosity === 'verbose' ? 'detailed when needed' : 'balanced'}

## Traits
${traits.map(t => `- ${t}`).join('\n')}

## Avoid
${avoid.map(a => `- ${a}`).join('\n')}

## Guidelines
- Match their energy
- Be genuinely helpful, not performatively helpful
- Have opinions when asked
- Respect their time
`;

  return {
    tone,
    style: style.verbosity === 'concise' ? 'concise, no fluff' : 'balanced',
    humor: humor as 'none' | 'light' | 'frequent',
    traits: traits.slice(0, 6),
    avoid: avoid.slice(0, 6),
    soulMd,
  };
}

function sampleArray<T>(arr: T[], size: number): T[] {
  if (arr.length <= size) return arr;
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, size);
}

/**
 * Ultra-granular chunking for maximum recall precision
 * Each specific detail should be findable via vector search
 */
function chunkConversation(
  messages: Array<{ role: string; content: string }>,
  title: string
): Array<{ content: string; messageCount: number }> {
  const MAX_CHUNK_SIZE = 500;       // Hard max - prioritize granularity
  const OVERLAP_CHARS = 120;        // Context overlap between chunks
  const SUBSTANTIAL_MSG = 200;      // Messages this long get their own chunk
  
  // Format all messages
  const formattedMessages = messages.map(m => ({
    text: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`,
    length: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`.length,
    role: m.role,
  }));
  
  const chunks: Array<{ content: string; messageCount: number }> = [];
  
  // Helper to create chunk with header
  const makeChunk = (texts: string[], msgCount: number) => {
    const partNum = chunks.length + 1;
    const header = `[Conversation: ${title}] [Part ${partNum}]`;
    chunks.push({
      content: `${header}\n${texts.join('\n\n')}`,
      messageCount: msgCount,
    });
  };
  
  // Track overlap context from previous chunk
  let overlapText = '';
  let i = 0;
  
  while (i < formattedMessages.length) {
    const msg = formattedMessages[i];
    
    // Substantial messages get their own chunk (possibly with overlap prefix)
    if (msg.length >= SUBSTANTIAL_MSG) {
      // If message itself exceeds max, split it into sub-chunks
      if (msg.length > MAX_CHUNK_SIZE) {
        const words = msg.text.split(' ');
        let subChunk = overlapText ? overlapText + '\n\n' : '';
        let wordIdx = 0;
        
        while (wordIdx < words.length) {
          const word = words[wordIdx];
          if (subChunk.length + word.length + 1 > MAX_CHUNK_SIZE && subChunk.length > 0) {
            // Flush current sub-chunk
            const partNum = chunks.length + 1;
            const header = `[Conversation: ${title}] [Part ${partNum}]`;
            chunks.push({ content: `${header}\n${subChunk.trim()}`, messageCount: 1 });
            
            // Start new sub-chunk with overlap
            const overlapWords = subChunk.split(' ').slice(-15).join(' '); // ~100-150 chars
            subChunk = overlapWords + ' ';
          }
          subChunk += word + ' ';
          wordIdx++;
        }
        
        // Flush remaining
        if (subChunk.trim()) {
          const partNum = chunks.length + 1;
          const header = `[Conversation: ${title}] [Part ${partNum}]`;
          chunks.push({ content: `${header}\n${subChunk.trim()}`, messageCount: 1 });
          overlapText = subChunk.trim().slice(-OVERLAP_CHARS);
        }
      } else {
        // Message fits in one chunk
        const content = overlapText ? overlapText + '\n\n' + msg.text : msg.text;
        makeChunk([content], 1);
        overlapText = msg.text.slice(-OVERLAP_CHARS);
      }
      i++;
      continue;
    }
    
    // Accumulate smaller messages until we hit the limit
    let accumulated: string[] = overlapText ? [overlapText] : [];
    let accumulatedLength = overlapText.length;
    let msgCount = 0;
    
    while (i < formattedMessages.length) {
      const nextMsg = formattedMessages[i];
      
      // If next message is substantial, break and let it get its own chunk
      if (nextMsg.length >= SUBSTANTIAL_MSG) break;
      
      // If adding this would exceed max, break
      if (accumulatedLength + nextMsg.length + 2 > MAX_CHUNK_SIZE && msgCount > 0) break;
      
      accumulated.push(nextMsg.text);
      accumulatedLength += nextMsg.length + 2;
      msgCount++;
      i++;
    }
    
    if (msgCount > 0) {
      // Remove overlap prefix from message count
      const texts = overlapText ? accumulated.slice(1) : accumulated;
      const fullText = accumulated.join('\n\n');
      const partNum = chunks.length + 1;
      const header = `[Conversation: ${title}] [Part ${partNum}]`;
      chunks.push({ content: `${header}\n${fullText}`, messageCount: msgCount });
      overlapText = fullText.slice(-OVERLAP_CHARS);
    }
  }
  
  // Edge case: very short conversation, ensure at least 1 chunk
  if (chunks.length === 0 && formattedMessages.length > 0) {
    const content = `[Conversation: ${title}]\n${formattedMessages.map(m => m.text).join('\n\n')}`;
    return [{ content, messageCount: messages.length }];
  }
  
  return chunks;
}
