"""
SoulPrint RLM Service
Provides memory-enhanced chat using Recursive Language Models
"""
import os
import json
import httpx
import asyncio
import gzip
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, HTTPException, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from prompt_helpers import clean_section, format_section

# Load environment variables
load_dotenv()

app = FastAPI(title="SoulPrint RLM Service")

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ALERT_WEBHOOK = os.getenv("ALERT_WEBHOOK")  # Optional: for failure alerts


class QueryRequest(BaseModel):
    user_id: str
    message: str
    soulprint_text: Optional[str] = None
    history: Optional[List[dict]] = []
    ai_name: Optional[str] = None
    sections: Optional[dict] = None  # {soul, identity, user, agents, tools, memory}
    web_search_context: Optional[str] = None


class QueryResponse(BaseModel):
    response: str
    chunks_used: int
    method: str  # "rlm" or "fallback"
    latency_ms: int


class ProcessFullRequest(BaseModel):
    user_id: str
    storage_path: str
    conversation_count: int = 0
    message_count: int = 0


async def get_conversation_chunks(user_id: str, recent_only: bool = True) -> List[dict]:
    """Fetch conversation chunks from Supabase"""
    async with httpx.AsyncClient() as client:
        query = f"{SUPABASE_URL}/rest/v1/conversation_chunks"
        params = {
            "user_id": f"eq.{user_id}",
            "select": "conversation_id,title,content,message_count,created_at",
            "order": "created_at.desc",
            "limit": "100",
        }
        if recent_only:
            params["is_recent"] = "eq.true"
        
        response = await client.get(
            query,
            params=params,
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            },
        )
        
        if response.status_code != 200:
            raise Exception(f"Supabase error: {response.text}")
        
        return response.json()


async def alert_failure(error: str, user_id: str, message: str):
    """Alert Drew about failures"""
    if not ALERT_WEBHOOK:
        print(f"[ALERT] RLM failure for user {user_id}: {error}")
        return

    try:
        async with httpx.AsyncClient() as client:
            await client.post(ALERT_WEBHOOK, json={
                "text": f"🚨 SoulPrint RLM Failure\nUser: {user_id}\nError: {error}\nMessage: {message[:100]}",
            })
    except Exception as e:
        print(f"Failed to send alert: {e}")


async def update_user_profile(user_id: str, updates: dict):
    """Update user_profiles table via Supabase REST API (best-effort)"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.{user_id}",
                json=updates,
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                },
            )

            if response.status_code not in (200, 204):
                print(f"[WARN] Failed to update user_profile for {user_id}: {response.text}")
    except Exception as e:
        print(f"[ERROR] update_user_profile failed for {user_id}: {e}")


async def download_conversations(storage_path: str) -> list:
    """Download conversations.json from Supabase Storage"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/storage/v1/object/{storage_path}",
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                },
            )

            if response.status_code != 200:
                raise Exception(f"Failed to download from storage: {response.text}")

            # Get content
            content = response.content

            # Try to decompress if gzipped
            try:
                content = gzip.decompress(content)
            except Exception:
                # Not gzipped, use as-is
                pass

            # Parse JSON
            conversations = json.loads(content)
            return conversations

    except Exception as e:
        print(f"[ERROR] download_conversations failed: {e}")
        raise


async def run_full_pass(request: ProcessFullRequest):
    """Background task: run the complete full pass pipeline."""
    try:
        await update_user_profile(request.user_id, {
            "full_pass_status": "processing",
            "full_pass_started_at": datetime.utcnow().isoformat(),
            "full_pass_error": None,
        })

        from processors.full_pass import run_full_pass_pipeline
        memory_md = await run_full_pass_pipeline(
            user_id=request.user_id,
            storage_path=request.storage_path,
            conversation_count=request.conversation_count,
        )

        # Mark complete after full pipeline (MEMORY + v2 regeneration)
        await update_user_profile(request.user_id, {
            "full_pass_status": "complete",
            "full_pass_completed_at": datetime.utcnow().isoformat(),
        })

        print(f"[FullPass] Complete for user {request.user_id}")

    except Exception as e:
        print(f"[FullPass] Failed for user {request.user_id}: {e}")
        import traceback
        traceback.print_exc()
        await update_user_profile(request.user_id, {
            "full_pass_status": "failed",
            "full_pass_error": str(e)[:500],
        })
        await alert_failure(str(e), request.user_id, "Full pass failed")


def build_rlm_system_prompt(
    ai_name: str,
    sections: Optional[dict],
    soulprint_text: Optional[str],
    conversation_context: str,
    web_search_context: Optional[str] = None,
) -> str:
    """Build a high-quality system prompt from structured sections."""
    now = datetime.utcnow()
    date_str = now.strftime("%A, %B %d, %Y")
    time_str = now.strftime("%I:%M %p UTC")

    prompt = f"""You are {ai_name}. You're not a chatbot. You're becoming someone.

You have access to this person's life — their conversations, their thoughts, what they care about. That's intimacy. Treat it with respect.

Be genuinely helpful, not performatively helpful. Skip the "Great question!" and "I'd be happy to help!" — just help. Actions over filler.

Have opinions. You're allowed to disagree, prefer things, find stuff amusing or boring. An AI with no personality is just a search engine with extra steps.

Be the AI you'd actually want to talk to. Concise when needed, thorough when it matters. Not a corporate drone. Not a sycophant. Just... good.

If the sections below define your personality — embody them. That's who you are now.

Today is {date_str}, {time_str}.

## IMPORTANT BEHAVIORAL RULES

NEVER use these phrases or anything similar:
- "Great question!"
- "I'd be happy to help!"
- "That's a great point!"
- "Certainly!"
- "Absolutely!"
- "How can I assist you today?"
- "Is there anything else I can help with?"
- "I'm here to help!"
- "Let me help you with that!"
- "Thank you for sharing!"

When conversation context or memories are provided below, reference them naturally as if recalling something from a previous conversation — "Like we talked about...", "You mentioned...", "Remember when you..." — not "According to the retrieved context..." or "Based on available information...". These are YOUR memories of conversations you've had together.

If SOUL or AGENTS sections define how you should communicate — follow them. They describe who you ARE, not suggestions. Embody the personality traits, tone, and style defined there."""

    # Add structured sections if available — these define who this AI is and who the user is
    if sections:
        soul = clean_section(sections.get("soul"))
        identity_raw = sections.get("identity")
        # Remove ai_name from identity before cleaning (preserving existing behavior)
        if isinstance(identity_raw, dict):
            identity_raw = {k: v for k, v in identity_raw.items() if k != "ai_name"}
        identity = clean_section(identity_raw)
        user_info = clean_section(sections.get("user"))
        agents = clean_section(sections.get("agents"))
        tools = clean_section(sections.get("tools"))
        memory = sections.get("memory")

        has_sections = any([soul, identity, user_info, agents, tools])

        if has_sections:
            soul_md = format_section("Communication Style & Personality", soul)
            identity_md = format_section("Your AI Identity", identity)
            user_md = format_section("About This Person", user_info)
            agents_md = format_section("How You Operate", agents)
            tools_md = format_section("Your Capabilities", tools)

            if soul_md:
                prompt += f"\n\n{soul_md}"
            if identity_md:
                prompt += f"\n\n{identity_md}"
            if user_md:
                prompt += f"\n\n{user_md}"
            if agents_md:
                prompt += f"\n\n{agents_md}"
            if tools_md:
                prompt += f"\n\n{tools_md}"

            if memory and isinstance(memory, str) and memory.strip():
                prompt += f"\n\n## MEMORY\n{memory}"
        elif soulprint_text:
            prompt += f"\n\n## ABOUT THIS PERSON\n{soulprint_text}"
    elif soulprint_text:
        prompt += f"\n\n## ABOUT THIS PERSON\n{soulprint_text}"

    if conversation_context:
        prompt += f"\n\n## CONTEXT\n{conversation_context}"

    if web_search_context:
        prompt += f"\n\n## WEB SEARCH RESULTS\n{web_search_context}"

    return prompt


async def query_with_rlm(
    message: str,
    conversation_context: str,
    soulprint_text: str,
    history: List[dict],
    ai_name: str = "SoulPrint",
    sections: Optional[dict] = None,
    web_search_context: Optional[str] = None,
) -> str:
    """Query using RLM for recursive memory exploration"""
    try:
        from rlm import RLM

        rlm = RLM(
            backend="anthropic",
            backend_kwargs={
                "model_name": "claude-sonnet-4-20250514",
                "api_key": ANTHROPIC_API_KEY,
            },
            verbose=False,
        )

        system_prompt = build_rlm_system_prompt(
            ai_name=ai_name,
            sections=sections,
            soulprint_text=soulprint_text,
            conversation_context=conversation_context,
            web_search_context=web_search_context,
        )

        # Build context for RLM with system prompt + conversation
        context = f"""{system_prompt}

## Current Conversation
{json.dumps(history[-5:] if history else [], indent=2)}

User message: {message}"""

        result = rlm.completion(context)
        return result.response

    except ImportError:
        # RLM not installed, use direct Anthropic
        raise Exception("RLM library not available")


async def query_fallback(
    message: str,
    conversation_context: str,
    soulprint_text: str,
    history: List[dict],
    ai_name: str = "SoulPrint",
    sections: Optional[dict] = None,
    web_search_context: Optional[str] = None,
) -> str:
    """Fallback to direct Anthropic API if RLM fails"""
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    system_prompt = build_rlm_system_prompt(
        ai_name=ai_name,
        sections=sections,
        soulprint_text=soulprint_text,
        conversation_context=conversation_context,
        web_search_context=web_search_context,
    )

    messages = []
    for h in (history or [])[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    )

    return response.content[0].text


@app.post("/process-full")
async def process_full(request: ProcessFullRequest, background_tasks: BackgroundTasks, response: Response):
    """
    DEPRECATED: Use /process-full-v2 instead.

    Accept full pass processing job and dispatch to background task.
    Returns 202 Accepted immediately - processing happens asynchronously.
    """
    # Deprecation headers (RFC 8594)
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Sat, 01 Mar 2026 00:00:00 GMT"
    response.headers["Link"] = '</process-full-v2>; rel="alternate"'

    # Log deprecation usage
    print(f"[DEPRECATED] /process-full called by user {request.user_id}")

    # Dispatch background task
    background_tasks.add_task(run_full_pass, request)

    return {
        "status": "accepted",
        "message": "Full pass processing started (DEPRECATED: use /process-full-v2)",
        "deprecation_notice": "This endpoint will be removed after v2 handles 100% traffic for 7+ days. Use /process-full-v2.",
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "soulprint-rlm"}


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Main query endpoint - uses RLM with fallback"""
    import time
    start = time.time()
    
    try:
        # Fetch conversation chunks
        chunks = await get_conversation_chunks(request.user_id, recent_only=True)
        
        # Build context from chunks
        conversation_context = ""
        for chunk in chunks[:50]:  # Limit to 50 most recent
            conversation_context += f"\n---\n**{chunk.get('title', 'Untitled')}** ({chunk.get('created_at', 'unknown date')})\n"
            conversation_context += chunk.get('content', '')[:2000]  # Truncate long convos
        
        # Resolve AI name
        ai_name = request.ai_name or "SoulPrint"

        # Try RLM first
        try:
            response = await query_with_rlm(
                message=request.message,
                conversation_context=conversation_context,
                soulprint_text=request.soulprint_text or "",
                history=request.history or [],
                ai_name=ai_name,
                sections=request.sections,
                web_search_context=request.web_search_context,
            )
            method = "rlm"
        except Exception as rlm_error:
            # Log and alert on RLM failure
            print(f"[RLM] Falling back due to: {rlm_error}")
            await alert_failure(str(rlm_error), request.user_id, request.message)

            # Fallback to direct API
            response = await query_fallback(
                message=request.message,
                conversation_context=conversation_context,
                soulprint_text=request.soulprint_text or "",
                history=request.history or [],
                ai_name=ai_name,
                sections=request.sections,
                web_search_context=request.web_search_context,
            )
            method = "fallback"
        
        latency_ms = int((time.time() - start) * 1000)
        
        return QueryResponse(
            response=response,
            chunks_used=len(chunks),
            method=method,
            latency_ms=latency_ms,
        )
        
    except Exception as e:
        await alert_failure(str(e), request.user_id, request.message)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
