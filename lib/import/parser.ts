/**
 * ChatGPT Export Parser
 * Parses the conversations.json from a ChatGPT data export ZIP
 */

import JSZip from 'jszip';

export interface ChatGPTMessage {
  id: string;
  author: {
    role: 'user' | 'assistant' | 'system' | 'tool';
    name?: string;
    metadata?: Record<string, unknown>;
  };
  content: {
    content_type: string;
    parts?: string[];
    text?: string;
  };
  create_time?: number;
  update_time?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, {
    id: string;
    message?: ChatGPTMessage;
    parent?: string;
    children: string[];
  }>;
  current_node?: string;
}

export interface ParsedConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ParsedMessage[];
}

export interface ParsedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: Date;
}

/**
 * Parse a ChatGPT export ZIP file and extract conversations
 */
export async function parseExportZip(zipBuffer: Buffer): Promise<ParsedConversation[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  
  // Find conversations.json in the ZIP
  const conversationsFile = zip.file('conversations.json');
  if (!conversationsFile) {
    throw new Error('conversations.json not found in ZIP archive');
  }
  
  const conversationsJson = await conversationsFile.async('string');
  const rawConversations: ChatGPTConversation[] = JSON.parse(conversationsJson);
  
  return rawConversations.map(parseConversation).filter(c => c.messages.length > 0);
}

/**
 * Parse a single conversation from ChatGPT's format
 */
function parseConversation(raw: ChatGPTConversation): ParsedConversation {
  const messages: ParsedMessage[] = [];
  
  // Build ordered message list by traversing the tree
  const orderedMessages = getOrderedMessages(raw.mapping, raw.current_node);
  
  for (const node of orderedMessages) {
    if (!node.message) continue;
    
    const msg = node.message;
    const content = extractContent(msg.content);
    
    // Skip empty messages or system messages we don't care about
    if (!content || content.trim().length === 0) continue;
    if (msg.author.role === 'system') continue;
    if (msg.author.role === 'tool') continue; // Skip tool calls for now
    
    messages.push({
      id: msg.id,
      role: msg.author.role as 'user' | 'assistant',
      content: content.trim(),
      timestamp: msg.create_time ? new Date(msg.create_time * 1000) : undefined,
    });
  }
  
  return {
    id: raw.id,
    title: raw.title || 'Untitled Conversation',
    createdAt: new Date(raw.create_time * 1000),
    updatedAt: new Date(raw.update_time * 1000),
    messages,
  };
}

/**
 * Extract ordered messages from the tree structure
 */
function getOrderedMessages(
  mapping: ChatGPTConversation['mapping'],
  currentNode?: string
): Array<{ id: string; message?: ChatGPTMessage }> {
  const ordered: Array<{ id: string; message?: ChatGPTMessage }> = [];
  
  // Find root node (the one with no parent or parent not in mapping)
  let rootId: string | undefined;
  for (const [id, node] of Object.entries(mapping)) {
    if (!node.parent || !mapping[node.parent]) {
      rootId = id;
      break;
    }
  }
  
  if (!rootId) return ordered;
  
  // DFS traversal following the path to current_node (or just first child)
  function traverse(nodeId: string, targetPath: Set<string>) {
    const node = mapping[nodeId];
    if (!node) return;
    
    // Only add nodes that have messages
    if (node.message) {
      ordered.push({ id: nodeId, message: node.message });
    }
    
    // Follow children - prefer the path to current_node, otherwise first child
    if (node.children.length > 0) {
      const nextChild = node.children.find(c => targetPath.has(c)) || node.children[0];
      traverse(nextChild, targetPath);
    }
  }
  
  // Build path from current_node back to root
  const targetPath = new Set<string>();
  if (currentNode) {
    let nodeId: string | undefined = currentNode;
    while (nodeId && mapping[nodeId]) {
      targetPath.add(nodeId);
      nodeId = mapping[nodeId].parent;
    }
  }
  
  traverse(rootId, targetPath);
  return ordered;
}

/**
 * Extract text content from ChatGPT message content object
 */
function extractContent(content: ChatGPTMessage['content']): string {
  if (!content) return '';
  
  if (content.text) return content.text;
  
  if (content.parts && Array.isArray(content.parts)) {
    // Filter to only string parts (skip image references, etc.)
    return content.parts
      .filter((part): part is string => typeof part === 'string')
      .join('\n');
  }
  
  return '';
}
