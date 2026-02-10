# Phase 2: Parsing Quality - DAG Traversal and Content Handling - Research

**Researched:** 2026-02-09
**Domain:** ChatGPT export format parsing, DAG traversal, message filtering
**Confidence:** HIGH

## Summary

ChatGPT export files (`conversations.json`) use a directed acyclic graph (DAG) structure where conversations can branch due to message edits and regenerations. The `current_node` field marks the final active message, and proper parsing requires backward traversal through the `parent` chain to extract only the active conversation path, avoiding "dead branches" from abandoned edits.

Current parsing in `streaming_import.py` and `conversation_chunker.py` traverses from root node forward through children, which captures ALL branches including edited/abandoned messages. This creates duplicate content in soulprints and undermines personality analysis accuracy.

**Primary recommendation:** Implement backward traversal from `current_node` through `parent` chain (instead of forward traversal through `children`), filter hidden messages by checking `author.role` and `metadata.is_user_system_message`, and handle all `content.parts` elements (not just `parts[0]`) to capture multimodal content.

## Standard Stack

The established libraries/tools for ChatGPT export parsing:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ijson | 3.x | Streaming JSON parser | Already used in streaming_import.py - constant memory for 300MB+ files |
| Python stdlib | 3.12+ | Core parsing logic | No additional dependencies needed for DAG traversal |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | Latest | Async HTTP for Supabase | Already used in streaming_import.py for download |
| tempfile | stdlib | Temporary file handling | Already used for streaming to disk |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Backward traversal from current_node | Forward traversal from root | Forward captures dead branches - accurate soulprints require current_node approach |
| ijson streaming | json.load() full file | Full load causes OOM on 300MB+ exports - streaming is non-negotiable |

**Installation:**
No new dependencies required - all tools already in use.

## Architecture Patterns

### Recommended DAG Traversal Pattern

The ChatGPT export format structure:
```python
{
  "id": "conv-123",
  "title": "Conversation Title",
  "create_time": 1700000000,
  "current_node": "node-final-uuid",  # Start here for active path
  "mapping": {
    "node-uuid-1": {
      "id": "node-uuid-1",
      "message": { ... },
      "parent": None,          # Root node
      "children": ["node-uuid-2", "node-uuid-3"]  # Multiple children = branch point
    },
    "node-uuid-2": {
      "id": "node-uuid-2",
      "message": { ... },
      "parent": "node-uuid-1",
      "children": ["node-uuid-4"]
    },
    "node-uuid-3": {  # Dead branch from edit
      "id": "node-uuid-3",
      "message": { ... },
      "parent": "node-uuid-1",
      "children": []
    },
    "node-final-uuid": {
      "id": "node-final-uuid",
      "message": { ... },
      "parent": "node-uuid-2",
      "children": []
    }
  }
}
```

### Pattern 1: Backward Traversal from current_node
**What:** Start at `current_node`, follow `parent` chain backward to root, reverse to get chronological order.
**When to use:** Always - this is the ONLY way to get the active conversation path.
**Example:**
```python
# Source: Community best practices + convoviz reference implementation
def extract_active_path(conversation: dict) -> list:
    """Extract only the active conversation path, skipping dead branches."""
    mapping = conversation.get("mapping", {})
    current_node = conversation.get("current_node")

    if not current_node or not mapping:
        return []

    # Backward traversal from current_node to root
    messages = []
    node_id = current_node

    while node_id:
        node = mapping.get(node_id)
        if not node:
            break

        # Extract message if present
        if node.get("message"):
            messages.append(node["message"])

        # Move to parent
        node_id = node.get("parent")

    # Reverse to get chronological order (root to current)
    messages.reverse()

    return messages
```

### Pattern 2: Hidden Message Filtering
**What:** Filter out internal/tool messages that aren't part of user-AI conversation.
**When to use:** After extracting messages, before soulprint generation.
**Example:**
```python
# Source: OpenAI community forum discussions
def is_visible_message(message: dict) -> bool:
    """Check if message should be included in soulprint."""
    author = message.get("author", {})
    role = author.get("role")
    metadata = message.get("metadata", {})

    # Filter out tool outputs (DALL-E, browsing, code interpreter)
    if role == "tool":
        return False

    # Filter out system messages unless explicitly user-created
    if role == "system" and not metadata.get("is_user_system_message"):
        return False

    # Keep user and assistant messages
    if role in ["user", "assistant"]:
        return True

    return False
```

### Pattern 3: Full content.parts Handling
**What:** Extract ALL parts from content.parts array, not just parts[0].
**When to use:** Always - multimodal messages have multiple parts (text, images, attachments).
**Example:**
```python
# Source: Existing lib/mem0/chatgpt-parser.ts pattern
def extract_content(content_data: dict) -> str:
    """Extract all text content from content.parts."""
    if not content_data:
        return ""

    # Handle text field directly (some formats)
    if "text" in content_data:
        return content_data["text"]

    # Handle parts array (most common)
    parts = content_data.get("parts", [])
    text_parts = []

    for part in parts:
        if isinstance(part, str):
            text_parts.append(part)
        elif isinstance(part, dict):
            # Multimodal content - extract text field
            if "text" in part:
                text_parts.append(part["text"])
            # Note: Image content has asset_pointer, not text

    return "\n".join(text_parts).strip()
```

### Pattern 4: Format Detection (Array vs Wrapped)
**What:** Handle both `[...]` and `{ "conversations": [...] }` export formats.
**When to use:** File parsing stage (already implemented in streaming_import.py).
**Example:**
```python
# Source: Already working in streaming_import.py
# Try bare array format first
parser = ijson.items(f, "item")
conversations = list(parser)

# If no items, try wrapped format
if len(conversations) == 0:
    f.seek(0)
    parser = ijson.items(f, "conversations.item")
    conversations = list(parser)
```

### Anti-Patterns to Avoid
- **Forward traversal from root through children:** Captures dead branches, creates duplicate messages in soulprint
- **Sorting all mapping nodes by create_time:** Includes edited-out messages that user never intended to keep
- **Using only parts[0]:** Loses multimodal content and multi-part messages
- **Filtering messages AFTER aggregation:** Harder to debug, should filter during extraction

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Large JSON parsing | Custom streaming parser | ijson library | Already in use, battle-tested for 300MB+ files, constant memory |
| DAG traversal | Graph library or complex recursion | Simple while loop with parent chain | Conversation DAG is simple (single path backward), no cycles |
| Message deduplication | SHA1 hashing per message | Current_node traversal | Proper traversal prevents duplicates at source |
| Content extraction | Regex parsing of text | Structured field access | ChatGPT export is well-structured JSON |

**Key insight:** The ChatGPT export format is well-designed - trust the structure. `current_node` exists specifically to identify the active path. Fighting the format leads to bugs.

## Common Pitfalls

### Pitfall 1: Forward Traversal Captures Dead Branches
**What goes wrong:** Traversing from root through `children` arrays includes ALL messages, including edited-out/regenerated versions.
**Why it happens:** Children arrays contain ALL child nodes, not just active path. When user edits a message, both original and edit are children of the parent.
**How to avoid:** Always start from `current_node` and traverse backward through `parent` chain.
**Warning signs:** Soulprint contains duplicate or contradictory statements, message count higher than user expects.

### Pitfall 2: Assuming All Messages Are User-Assistant Dialog
**What goes wrong:** Including tool outputs (DALL-E generation metadata, browsing results, code interpreter logs) pollutes soulprint with internal system data.
**Why it happens:** Export file contains complete conversation graph including all tool interactions.
**How to avoid:** Filter by `author.role` - keep only "user" and "assistant", skip "tool" and "system" (unless `metadata.is_user_system_message` is true).
**Warning signs:** Soulprint contains JSON blobs, "search results", "image generated with prompt:", reasoning traces.

### Pitfall 3: Using Only parts[0]
**What goes wrong:** Messages with multiple content parts (text + image description, multi-part responses) lose all content after first part.
**Why it happens:** Assumption that parts is always single-element array.
**How to avoid:** Iterate through ALL parts, extract text from each (strings directly, objects via .text field).
**Warning signs:** User reports "missing content" or "conversation feels incomplete", image-related conversations have gaps.

### Pitfall 4: Missing current_node Field
**What goes wrong:** Some older exports might not have `current_node` field, causing traversal to fail.
**Why it happens:** Export format evolved over time.
**How to avoid:** Fall back to root-first traversal ONLY if current_node is missing. Log warning for monitoring.
**Warning signs:** Import fails completely for older exports, error logs show "current_node not found".

### Pitfall 5: Not Reversing Backward Traversal
**What goes wrong:** Messages appear in reverse chronological order (newest first instead of oldest first).
**Why it happens:** Backward traversal naturally collects messages from current → root, need to reverse.
**How to avoid:** Always `.reverse()` the message list after backward traversal.
**Warning signs:** Soulprint reads backwards, conversation flow makes no sense.

## Code Examples

Verified patterns for implementation:

### Complete Active Path Extraction
```python
# Source: Community best practices + reference implementations
def parse_conversation_with_dag(conversation: dict) -> list:
    """
    Parse ChatGPT conversation using current_node DAG traversal.
    Returns only messages in the active conversation path.
    """
    mapping = conversation.get("mapping", {})
    current_node = conversation.get("current_node")

    # Fallback for older exports without current_node
    if not current_node:
        print(f"[parse] WARNING: No current_node in conversation {conversation.get('id')}, using root traversal")
        return parse_conversation_fallback(conversation)

    # Backward traversal from current_node
    raw_messages = []
    node_id = current_node

    while node_id and node_id in mapping:
        node = mapping[node_id]
        message = node.get("message")

        if message:
            raw_messages.append(message)

        node_id = node.get("parent")

    # Reverse to chronological order
    raw_messages.reverse()

    # Filter visible messages and extract content
    parsed_messages = []
    for msg in raw_messages:
        if not is_visible_message(msg):
            continue

        author = msg.get("author", {})
        role = author.get("role")
        content = extract_content(msg.get("content", {}))

        if content.strip():
            parsed_messages.append({
                "role": role,
                "content": content,
                "create_time": msg.get("create_time", 0)
            })

    return parsed_messages

def is_visible_message(message: dict) -> bool:
    """Filter out hidden/internal messages."""
    author = message.get("author", {})
    role = author.get("role")
    metadata = message.get("metadata", {})

    # Skip tool outputs
    if role == "tool":
        return False

    # Skip system messages unless user-created
    if role == "system" and not metadata.get("is_user_system_message"):
        return False

    return role in ["user", "assistant"]

def extract_content(content_data: dict) -> str:
    """Extract all text from content.parts."""
    if not content_data:
        return ""

    # Direct text field
    if "text" in content_data:
        return content_data["text"]

    # Parts array
    parts = content_data.get("parts", [])
    text_parts = []

    for part in parts:
        if isinstance(part, str):
            text_parts.append(part)
        elif isinstance(part, dict) and "text" in part:
            text_parts.append(part["text"])

    return "\n".join(text_parts).strip()
```

### Integration with Existing streaming_import.py
```python
# Modification to streaming_import.py parse_conversations_streaming()
def parse_conversations_streaming(file_path: str) -> list:
    """Parse ChatGPT conversations.json with proper DAG traversal."""
    conversations = []

    with open(file_path, "rb") as f:
        try:
            # Try bare array format first
            parser = ijson.items(f, "item")
            raw_convos = list(parser)

            # If empty, try wrapped format
            if len(raw_convos) == 0:
                f.seek(0)
                parser = ijson.items(f, "conversations.item")
                raw_convos = list(parser)
        except Exception as e:
            print(f"[streaming_import] ERROR: Parse failed: {e}")
            return []

    # Process each conversation with DAG traversal
    for raw_convo in raw_convos:
        parsed_messages = parse_conversation_with_dag(raw_convo)

        if parsed_messages:
            conversations.append({
                "id": raw_convo.get("id"),
                "title": raw_convo.get("title", "Untitled"),
                "createdAt": datetime.fromtimestamp(raw_convo.get("create_time", 0)).isoformat(),
                "messages": parsed_messages
            })

    print(f"[streaming_import] Parsed {len(conversations)} conversations with DAG traversal")
    return conversations
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Root-first traversal | current_node backward traversal | Community best practice 2024-2025 | Eliminates duplicate messages from edits |
| Sort by create_time | Follow parent chain | Discovered through export analysis | Proper DAG structure respect |
| parts[0] only | All parts iteration | Multimodal support added ~2023 | Captures images, attachments |
| Single export format | Dual format support | Export format updated 2024 | Handles both array and wrapped formats |

**Deprecated/outdated:**
- **Root-first children traversal**: Includes dead branches, creates duplicates
- **Assuming single parent per node**: While true in practice, some tools incorrectly assume tree structure
- **Ignoring current_node**: Early parsers didn't use this field, led to wrong path selection

## Open Questions

Things that couldn't be fully resolved:

1. **How prevalent are exports without current_node?**
   - What we know: Older export format might not include it
   - What's unclear: Percentage of real-world exports lacking this field
   - Recommendation: Implement fallback, monitor logs for frequency, consider user notification if common

2. **Are there other hidden message types beyond tool/system?**
   - What we know: role="tool" and role="system" are documented hidden types
   - What's unclear: ChatGPT adds features frequently (reasoning traces, canvas, search) - might be new role types
   - Recommendation: Log all unique role values encountered, review for new types quarterly

3. **How to handle reasoning/thinking messages from o1 models?**
   - What we know: Search results mention "thoughts" and "reasoning_recap" content types
   - What's unclear: Should these be included in soulprint (shows thinking style) or excluded (internal)?
   - Recommendation: Start by EXCLUDING (follow same pattern as tool messages), make configurable later if users want it

4. **Should multimodal content describe images?**
   - What we know: Images have asset_pointer, not text content
   - What's unclear: Should we include "[image]" placeholder or skip entirely?
   - Recommendation: Skip for now - soulprint is text-based, image content doesn't inform personality

## Sources

### Primary (HIGH confidence)
- [ChatGPT conversations.json structure documentation](https://community.openai.com/t/questions-about-the-json-structures-in-the-exported-conversations-json/954762) - Message fields, status values, metadata
- [Export format decoding discussion](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144) - current_node usage, parent chain traversal
- Existing codebase analysis:
  - `streaming_import.py` - ijson usage, format detection
  - `conversation_chunker.py` - Current traversal approach (forward from root)
  - `lib/mem0/chatgpt-parser.ts` - Content extraction pattern

### Secondary (MEDIUM confidence)
- [ChatGPT export guide](https://exploreaitogether.com/export-download-chatgpt-guide/) - Export process, file contents
- [Conversation branching explained](https://knowledge.buka.sh/the-hidden-fork-how-editing-messages-in-chatgpt-lets-you-branch-conversations/) - How edits create branches
- [chat-export-structurer tool](https://github.com/1ch1n/chat-export-structurer) - Deduplication strategies
- [ijson streaming best practices](https://pythonspeed.com/articles/json-memory-streaming/) - Memory-efficient parsing

### Tertiary (LOW confidence)
- [DAG traversal algorithms](https://object-oriented-python.github.io/9_trees_and_directed_acyclic_graphs.html) - General graph theory (not ChatGPT-specific)
- [Hidden ChatGPT features 2026](https://aiinsider.in/ai-learning/chatgpt-features-2026-hidden/) - Feature overview (not parsing-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ijson already in use and working, no new dependencies
- Architecture: HIGH - current_node pattern verified in community and reference implementations
- Pitfalls: HIGH - all pitfalls identified from codebase analysis and community discussions
- Code examples: HIGH - patterns verified against existing TypeScript parser and community solutions

**Research date:** 2026-02-09
**Valid until:** 2026-04-09 (60 days - ChatGPT export format is stable but features evolve quarterly)
