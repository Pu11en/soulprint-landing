"""
RLM Memory Service for SoulPrint - v1 (Simplified)

A Python microservice for intelligent memory retrieval using LLM exploration.
This version uses LiteLLM directly for Bedrock access.
RLM recursive features will be added in v2 once the basic flow is stable.
"""

import os
import json
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import litellm

app = FastAPI(title="RLM Memory Service", version="1.0.0")

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MemoryQuery(BaseModel):
    user_id: str
    query: str
    history: str
    max_results: int = 10


class MemoryResult(BaseModel):
    content: str
    significance: str = "medium"
    context: Optional[str] = None


class MemoryResponse(BaseModel):
    relevant_memories: list[dict]
    patterns_detected: list[str]
    user_context: str
    success: bool = True
    error: Optional[str] = None


def get_model() -> str:
    """Get the LiteLLM model string for Bedrock."""
    bedrock_model = os.getenv("BEDROCK_MODEL_ID", "us.anthropic.claude-3-5-haiku-20241022-v1:0")
    return f"bedrock/{bedrock_model}"


MEMORY_EXTRACTION_PROMPT = """You are a memory extraction agent. Your task is to find information in a user's conversation history that is relevant to their query.

USER QUERY: {query}

CONVERSATION HISTORY:
{history}

---

Analyze the history and extract ALL relevant information. Consider:
1. Direct mentions of the query topic
2. Related topics and context
3. Emotional significance
4. Patterns and recurring themes

Respond with a JSON object in this EXACT format:
{{
    "relevant_memories": [
        {{"content": "exact relevant quote or summary", "significance": "high/medium/low", "context": "why this is relevant"}}
    ],
    "patterns_detected": ["list of patterns you noticed"],
    "user_context": "brief summary of what this reveals about the user"
}}

Return ONLY valid JSON. No other text."""


@app.get("/health")
async def health():
    return {"status": "ok", "service": "rlm-memory", "model": get_model()}


@app.post("/query", response_model=MemoryResponse)
async def query_memory(req: MemoryQuery):
    """
    Query user's memory/history using LLM for intelligent extraction.
    """
    print(f"[Memory] Query: {req.query[:50]}...")
    print(f"[Memory] History length: {len(req.history)} chars")
    
    try:
        # Truncate history if too long (Claude has ~200k context but be safe)
        history = req.history[:100000] if len(req.history) > 100000 else req.history
        
        # Build prompt
        prompt = MEMORY_EXTRACTION_PROMPT.format(
            query=req.query,
            history=history
        )
        
        # Call LLM
        print(f"[Memory] Calling {get_model()}...")
        response = litellm.completion(
            model=get_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,  # Lower temp for more consistent extraction
        )
        
        response_text = response.choices[0].message.content
        print(f"[Memory] Response: {response_text[:200]}...")
        
        # Parse JSON response
        try:
            # Find JSON in response
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start >= 0 and end > start:
                parsed = json.loads(response_text[start:end])
                return MemoryResponse(
                    relevant_memories=parsed.get("relevant_memories", []),
                    patterns_detected=parsed.get("patterns_detected", []),
                    user_context=parsed.get("user_context", ""),
                    success=True,
                )
        except json.JSONDecodeError as e:
            print(f"[Memory] JSON parse error: {e}")
        
        # Fallback - return raw as single memory
        return MemoryResponse(
            relevant_memories=[{"content": response_text, "significance": "unknown"}],
            patterns_detected=[],
            user_context="",
            success=True,
        )
        
    except Exception as e:
        print(f"[Memory] Error: {e}")
        import traceback
        traceback.print_exc()
        return MemoryResponse(
            relevant_memories=[],
            patterns_detected=[],
            user_context="",
            error=str(e),
            success=False,
        )


@app.post("/explore")
async def explore_history(req: MemoryQuery):
    """
    Open-ended exploration of user's history for patterns and insights.
    """
    req.query = "Provide a comprehensive analysis: main interests, communication style, recurring topics, key decisions, and significant life events or projects."
    return await query_memory(req)


@app.post("/extract-personality")
async def extract_personality(req: MemoryQuery):
    """
    Extract personality traits for SoulPrint generation.
    """
    req.query = """Extract a complete personality profile:
    1. Communication style (formal/casual, verbose/concise)
    2. Key interests and passions
    3. Values and priorities
    4. Decision-making patterns
    5. Emotional tendencies
    6. Topics they care most about"""
    return await query_memory(req)


if __name__ == "__main__":
    port = int(os.getenv("RLM_PORT", "8100"))
    print(f"🧠 Memory Service starting on port {port}")
    print(f"📍 Model: {get_model()}")
    uvicorn.run(app, host="0.0.0.0", port=port)
