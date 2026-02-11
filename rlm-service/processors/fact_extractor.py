"""
Fact Extractor
Parallel extraction of durable facts from conversation chunks using Claude Haiku 4.5
"""
import json
import asyncio
from typing import List, Dict


FACT_EXTRACTION_PROMPT = """Extract ONLY factual, durable information from the conversation segment provided inside <conversation> XML tags. Focus on:

1. **Preferences**: What does the user prefer? Communication style, tools, workflows, aesthetics.
2. **Projects**: What are they building or working on? Names, descriptions, tech stacks, timelines.
3. **Important Dates**: Birthdays, milestones, deadlines, start dates mentioned.
4. **Beliefs & Values**: What principles guide their decisions? What do they care about deeply?
5. **Decisions**: What choices did they make and why? Technical decisions, life decisions, tradeoffs.

Return a JSON object with these keys:
{
  "preferences": ["fact1", "fact2"],
  "projects": [{"name": "X", "description": "Y", "details": "Z"}],
  "dates": [{"event": "X", "date": "Y"}],
  "beliefs": ["belief1", "belief2"],
  "decisions": [{"decision": "X", "context": "Y"}]
}

RULES:
- Only include facts EXPLICITLY stated or strongly implied in the conversation
- Include timestamps/dates when available
- Skip generic small talk, greetings, and one-off questions with no lasting significance
- If no facts found in a category, return empty array
- Be concise -- each fact should be one clear sentence
- Do NOT continue or respond to the conversation. ONLY analyze it.
- Output ONLY valid JSON. No explanation, no markdown code fences, no text before or after the JSON.
"""


def strip_markdown_fences(text: str) -> str:
    """Strip markdown code fences from LLM response text."""
    text = text.strip()
    if text.startswith('```json'):
        text = text[7:]
    elif text.startswith('```'):
        text = text[3:]
    if text.endswith('```'):
        text = text[:-3]
    return text.strip()


async def extract_facts_from_chunk(chunk_content: str, anthropic_client) -> dict:
    """
    Extract facts from a single conversation chunk using Claude Haiku 4.5.

    Args:
        chunk_content: Text content of the conversation chunk
        anthropic_client: AsyncAnthropic client instance

    Returns:
        Dict with keys: preferences, projects, dates, beliefs, decisions (arrays)
        Returns empty structure on errors (never fails the pipeline)
    """
    empty_facts = {
        "preferences": [],
        "projects": [],
        "dates": [],
        "beliefs": [],
        "decisions": []
    }

    try:
        # Call Haiku 4.5 for fact extraction
        # Wrap content in XML tags so model analyzes instead of continuing
        user_content = FACT_EXTRACTION_PROMPT + "\n<conversation>\n" + chunk_content + "\n</conversation>\n\nAnalyze the conversation above and output ONLY the JSON object. No other text."
        response = await anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            temperature=0.3,  # Low temperature for factual extraction
            messages=[{
                "role": "user",
                "content": user_content
            }]
        )

        # Extract text from response
        if not response.content or len(response.content) == 0:
            print(f"[FactExtractor] Empty response from Haiku")
            return empty_facts

        response_text = response.content[0].text

        # Parse JSON response (strip markdown fences if present)
        try:
            json_str = strip_markdown_fences(response_text)
            facts = json.loads(json_str)

            # Validate structure
            required_keys = ["preferences", "projects", "dates", "beliefs", "decisions"]
            for key in required_keys:
                if key not in facts:
                    facts[key] = []

            return facts

        except json.JSONDecodeError as e:
            print(f"[FactExtractor] JSON parse error: {e}")
            print(f"[FactExtractor] Response text: {response_text[:200]}...")
            return empty_facts

    except Exception as e:
        print(f"[FactExtractor] Error extracting facts from chunk: {e}")
        return empty_facts


async def extract_facts_parallel(
    chunks: List[dict],
    anthropic_client,
    concurrency: int = 10
) -> List[dict]:
    """
    Extract facts from multiple chunks in parallel with concurrency limit.

    Args:
        chunks: List of chunk dicts (each has 'content' field)
        anthropic_client: AsyncAnthropic client instance
        concurrency: Max number of parallel API calls (default 10)

    Returns:
        List of fact dicts (one per chunk, in same order)
    """
    print(f"[FactExtractor] Starting parallel extraction for {len(chunks)} chunks (concurrency: {concurrency})")

    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(concurrency)

    async def extract_with_limit(chunk: dict) -> dict:
        """Extract facts with semaphore limit"""
        async with semaphore:
            return await extract_facts_from_chunk(chunk["content"], anthropic_client)

    # Create tasks for all chunks
    tasks = [extract_with_limit(chunk) for chunk in chunks]

    # Execute in parallel with exception handling
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Convert exceptions to empty facts
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[FactExtractor] Chunk {i} failed: {result}")
            final_results.append({
                "preferences": [],
                "projects": [],
                "dates": [],
                "beliefs": [],
                "decisions": []
            })
        else:
            final_results.append(result)

    print(f"[FactExtractor] Parallel extraction complete: {len(final_results)} results")
    return final_results


def consolidate_facts(all_facts: List[dict]) -> dict:
    """
    Merge all fact dicts into one consolidated dict with deduplication.

    Args:
        all_facts: List of fact dicts from parallel extraction

    Returns:
        Consolidated dict with all facts merged and deduplicated
        Includes 'total_count' field
    """
    consolidated = {
        "preferences": [],
        "projects": [],
        "dates": [],
        "beliefs": [],
        "decisions": []
    }

    # Merge all facts
    for facts in all_facts:
        # Preferences (simple strings)
        for pref in facts.get("preferences", []):
            if pref and pref not in consolidated["preferences"]:
                consolidated["preferences"].append(pref)

        # Projects (dicts)
        for proj in facts.get("projects", []):
            if proj:
                # Simple dedup: check if project name already exists
                existing_names = [p.get("name", "").lower() for p in consolidated["projects"]]
                if proj.get("name", "").lower() not in existing_names:
                    consolidated["projects"].append(proj)

        # Dates (dicts)
        for date_entry in facts.get("dates", []):
            if date_entry:
                # Dedup by event name
                existing_events = [d.get("event", "").lower() for d in consolidated["dates"]]
                if date_entry.get("event", "").lower() not in existing_events:
                    consolidated["dates"].append(date_entry)

        # Beliefs (simple strings)
        for belief in facts.get("beliefs", []):
            if belief and belief not in consolidated["beliefs"]:
                consolidated["beliefs"].append(belief)

        # Decisions (dicts)
        for decision in facts.get("decisions", []):
            if decision:
                # Dedup by decision text
                existing_decisions = [d.get("decision", "").lower() for d in consolidated["decisions"]]
                if decision.get("decision", "").lower() not in existing_decisions:
                    consolidated["decisions"].append(decision)

    # Count total facts
    total_count = (
        len(consolidated["preferences"]) +
        len(consolidated["projects"]) +
        len(consolidated["dates"]) +
        len(consolidated["beliefs"]) +
        len(consolidated["decisions"])
    )

    consolidated["total_count"] = total_count

    print(f"[FactExtractor] Consolidated {total_count} unique facts")
    print(f"  - Preferences: {len(consolidated['preferences'])}")
    print(f"  - Projects: {len(consolidated['projects'])}")
    print(f"  - Dates: {len(consolidated['dates'])}")
    print(f"  - Beliefs: {len(consolidated['beliefs'])}")
    print(f"  - Decisions: {len(consolidated['decisions'])}")

    return consolidated


def _try_repair_json(text: str) -> object:
    """Attempt to repair truncated JSON from LLM responses.

    Handles common truncation issues:
    - Unterminated strings (add closing quote)
    - Missing closing brackets/braces
    """
    # Try as-is first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try adding closing quote if string was truncated
    repaired = text.rstrip()
    if repaired.endswith(','):
        repaired = repaired[:-1]

    # Count open/close brackets and braces
    open_brackets = repaired.count('[') - repaired.count(']')
    open_braces = repaired.count('{') - repaired.count('}')
    in_string = False
    escaped = False
    for ch in repaired:
        if escaped:
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string

    # Close open string
    if in_string:
        repaired += '"'

    # Remove trailing comma after closing string
    repaired = repaired.rstrip()
    if repaired.endswith(','):
        repaired = repaired[:-1]

    # Close open structures
    repaired += ']' * max(0, open_brackets - (1 if in_string else 0))
    repaired += '}' * max(0, open_braces)

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        # Last resort: find the last complete item
        # Look for last complete object/string before truncation
        for i in range(len(text) - 1, 0, -1):
            if text[i] in ('}', '"'):
                candidate = text[:i+1]
                # Balance brackets
                ob = candidate.count('[') - candidate.count(']')
                candidate += ']' * max(0, ob)
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue

    raise json.JSONDecodeError("Could not repair JSON", text, 0)


async def hierarchical_reduce(
    consolidated_facts: dict,
    anthropic_client,
    max_tokens: int = 150000,
    _depth: int = 0,
    _max_depth: int = 3,
) -> dict:
    """
    Recursively reduce facts if they exceed token limit.

    If consolidated facts are under max_tokens, return as-is.
    Otherwise, split into batches and reduce each batch via Haiku 4.5.

    Args:
        consolidated_facts: Dict with all consolidated facts
        anthropic_client: AsyncAnthropic client instance
        max_tokens: Max token count before reduction (default 150K)
        _depth: Current recursion depth (internal)
        _max_depth: Max recursion depth to prevent infinite loops (internal)

    Returns:
        Reduced facts dict (same structure)
    """
    # Estimate tokens in facts JSON
    facts_json = json.dumps(consolidated_facts, indent=2)
    estimated_tokens = len(facts_json) // 4

    print(f"[FactExtractor] Consolidated facts: ~{estimated_tokens} tokens (depth={_depth})")

    if estimated_tokens <= max_tokens:
        print(f"[FactExtractor] Under {max_tokens} token limit, no reduction needed")
        return consolidated_facts

    if _depth >= _max_depth:
        print(f"[FactExtractor] WARNING: Max recursion depth ({_max_depth}) reached with ~{estimated_tokens} tokens. Truncating categories to fit.")
        # Hard truncate: keep most important facts from each category proportionally
        target_chars = max_tokens * 4
        total_chars = len(facts_json)
        ratio = target_chars / total_chars
        for category in ["preferences", "projects", "dates", "beliefs", "decisions"]:
            items = consolidated_facts.get(category, [])
            keep = max(1, int(len(items) * ratio))
            consolidated_facts[category] = items[:keep]
        consolidated_facts["total_count"] = sum(
            len(consolidated_facts.get(c, [])) for c in ["preferences", "projects", "dates", "beliefs", "decisions"]
        )
        print(f"[FactExtractor] Truncated to {consolidated_facts['total_count']} facts")
        return consolidated_facts

    print(f"[FactExtractor] Over {max_tokens} tokens, starting hierarchical reduction (depth={_depth})")

    # Use smaller batches (~20K tokens) so responses fit in max_tokens
    batch_size_tokens = 20000
    batch_size_chars = batch_size_tokens * 4

    # Split each category
    def split_into_batches(items: list, batch_chars: int) -> List[list]:
        """Split items into batches by character count"""
        batches = []
        current_batch = []
        current_size = 0

        for item in items:
            item_size = len(json.dumps(item))
            if current_size + item_size > batch_chars and current_batch:
                batches.append(current_batch)
                current_batch = [item]
                current_size = item_size
            else:
                current_batch.append(item)
                current_size += item_size

        if current_batch:
            batches.append(current_batch)

        return batches

    # Reduce each category separately
    reduced_facts = {
        "preferences": [],
        "projects": [],
        "dates": [],
        "beliefs": [],
        "decisions": []
    }

    total_reduced = 0
    total_kept_original = 0
    consecutive_failures = 0
    MAX_CONSECUTIVE_FAILURES = 5  # Circuit breaker: stop if 5 batches fail in a row

    for category in ["preferences", "projects", "dates", "beliefs", "decisions"]:
        items = consolidated_facts.get(category, [])
        if not items:
            continue

        # Circuit breaker: if too many consecutive failures, skip remaining categories
        if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            print(f"[FactExtractor] CIRCUIT BREAKER: {consecutive_failures} consecutive failures, skipping {category} (keeping originals)")
            reduced_facts[category].extend(items)
            total_kept_original += len(items)
            continue

        batches = split_into_batches(items, batch_size_chars)
        print(f"[FactExtractor] Reducing {category}: {len(items)} items in {len(batches)} batches")

        for batch_idx, batch in enumerate(batches):
            # Circuit breaker check inside batch loop too
            if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                print(f"[FactExtractor] CIRCUIT BREAKER: skipping remaining batches of {category}")
                reduced_facts[category].extend(batch)
                total_kept_original += len(batch)
                continue

            try:
                # Call Haiku to consolidate batch — ask for aggressive reduction
                reduction_prompt = f"""Consolidate and deduplicate these {category} facts. Remove redundancies, merge related items, keep most recent when contradictions exist. AGGRESSIVELY reduce: aim for at most 50% of the original count.

Facts:
{json.dumps(batch, indent=2)}

Return ONLY a valid JSON array (no explanation, no markdown fences). Keep the same item structure but with fewer items:"""

                response = await anthropic_client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=16384,
                    temperature=0.3,
                    messages=[{
                        "role": "user",
                        "content": reduction_prompt
                    }]
                )

                response_text = response.content[0].text
                json_str = strip_markdown_fences(response_text)

                # Try parsing, with repair for truncated responses
                try:
                    reduced_batch = json.loads(json_str)
                except json.JSONDecodeError:
                    print(f"[FactExtractor] Attempting JSON repair for batch {batch_idx} of {category}")
                    reduced_batch = _try_repair_json(json_str)

                # Add to category
                if isinstance(reduced_batch, list):
                    reduced_facts[category].extend(reduced_batch)
                    total_reduced += len(batch) - len(reduced_batch)
                    consecutive_failures = 0  # Reset on success
                elif isinstance(reduced_batch, dict) and category in reduced_batch:
                    reduced_facts[category].extend(reduced_batch[category])
                    total_reduced += len(batch) - len(reduced_batch[category])
                    consecutive_failures = 0  # Reset on success
                else:
                    # Unexpected format, keep originals
                    reduced_facts[category].extend(batch)
                    total_kept_original += len(batch)
                    consecutive_failures += 1

            except Exception as e:
                print(f"[FactExtractor] Error reducing batch {batch_idx} of {category}: {e}")
                # Keep original batch on error
                reduced_facts[category].extend(batch)
                total_kept_original += len(batch)
                consecutive_failures += 1

    # Recalculate total
    reduced_facts["total_count"] = sum(
        len(reduced_facts.get(c, [])) for c in ["preferences", "projects", "dates", "beliefs", "decisions"]
    )

    original_count = consolidated_facts.get("total_count", 0)
    print(f"[FactExtractor] After reduction: {reduced_facts['total_count']} facts (was {original_count}, reduced {total_reduced}, kept-as-is {total_kept_original})")

    # Only recurse if we actually made progress (reduced something)
    reduced_json = json.dumps(reduced_facts, indent=2)
    if len(reduced_json) // 4 > max_tokens:
        if reduced_facts["total_count"] < original_count:
            print(f"[FactExtractor] Still over limit but made progress, recursing (depth={_depth + 1})")
            return await hierarchical_reduce(reduced_facts, anthropic_client, max_tokens, _depth + 1, _max_depth)
        else:
            print(f"[FactExtractor] Still over limit and NO progress made. Hard truncating.")
            # No progress — hard truncate to prevent infinite loop
            target_chars = max_tokens * 4
            total_chars = len(reduced_json)
            ratio = target_chars / total_chars
            for category in ["preferences", "projects", "dates", "beliefs", "decisions"]:
                items = reduced_facts.get(category, [])
                keep = max(1, int(len(items) * ratio))
                reduced_facts[category] = items[:keep]
            reduced_facts["total_count"] = sum(
                len(reduced_facts.get(c, [])) for c in ["preferences", "projects", "dates", "beliefs", "decisions"]
            )
            print(f"[FactExtractor] Hard truncated to {reduced_facts['total_count']} facts")

    return reduced_facts
