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
 * Smart chunking for conversations
 * Splits into smaller overlapping chunks for better vector search recall
 */
function chunkConversation(
  messages: Array<{ role: string; content: string }>,
  title: string
): Array<{ content: string; messageCount: number }> {
  const TARGET_CHUNK_SIZE = 1200;  // Target ~1000-1500 chars per chunk
  const MIN_CHUNK_SIZE = 800;      // Don't create tiny chunks
  const OVERLAP_CHARS = 200;       // Overlap between chunks
  const MIN_MESSAGES_PER_CHUNK = 2;
  
  // Format all messages
  const formattedMessages = messages.map(m => ({
    text: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`,
    length: `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`.length,
  }));
  
  // Calculate total content length
  const totalLength = formattedMessages.reduce((sum, m) => sum + m.length + 2, 0); // +2 for \n\n
  
  // If total is small enough, return single chunk
  if (totalLength <= TARGET_CHUNK_SIZE * 1.5 || messages.length < MIN_MESSAGES_PER_CHUNK * 2) {
    const content = `[Conversation: ${title}]\n${formattedMessages.map(m => m.text).join('\n\n')}`;
    return [{ content: content.slice(0, 8000), messageCount: messages.length }];
  }
  
  // Build chunks with overlap
  const chunks: Array<{ content: string; messageCount: number }> = [];
  let currentChunkStart = 0;
  
  while (currentChunkStart < formattedMessages.length) {
    let currentLength = 0;
    let endIndex = currentChunkStart;
    
    // Build chunk up to target size, respecting message boundaries
    while (endIndex < formattedMessages.length && currentLength < TARGET_CHUNK_SIZE) {
      currentLength += formattedMessages[endIndex].length + 2;
      endIndex++;
    }
    
    // Ensure minimum messages per chunk
    if (endIndex - currentChunkStart < MIN_MESSAGES_PER_CHUNK && endIndex < formattedMessages.length) {
      endIndex = Math.min(currentChunkStart + MIN_MESSAGES_PER_CHUNK, formattedMessages.length);
    }
    
    // Build chunk content with title and part number
    const chunkMessages = formattedMessages.slice(currentChunkStart, endIndex);
    const partNum = chunks.length + 1;
    const header = chunks.length === 0 
      ? `[Conversation: ${title}]`
      : `[Conversation: ${title}] [Part ${partNum}]`;
    
    const content = `${header}\n${chunkMessages.map(m => m.text).join('\n\n')}`;
    
    chunks.push({
      content,
      messageCount: endIndex - currentChunkStart,
    });
    
    // Move start forward, but include overlap
    // Find how many messages from the end to include as overlap
    let overlapLength = 0;
    let overlapMsgCount = 0;
    for (let i = endIndex - 1; i >= currentChunkStart && overlapLength < OVERLAP_CHARS; i--) {
      overlapLength += formattedMessages[i].length + 2;
      overlapMsgCount++;
    }
    
    // Next chunk starts with overlap messages
    const nextStart = endIndex - Math.max(1, overlapMsgCount);
    
    // Prevent infinite loop - always advance
    if (nextStart <= currentChunkStart) {
      currentChunkStart = endIndex;
    } else {
      currentChunkStart = nextStart;
    }
    
    // Break if we've processed all messages
    if (endIndex >= formattedMessages.length) break;
  }
  
  return chunks;
}
