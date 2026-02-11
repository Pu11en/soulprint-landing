"""
Embedding Generator
Generates Titan Embed v2 embeddings (768 dims) for conversation chunks via AWS Bedrock.
"""
import os
import json
import boto3
import httpx
from typing import List, Dict, Optional

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Lazy-init Bedrock client
_bedrock_client = None


def get_bedrock_client():
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client(
            'bedrock-runtime',
            region_name=os.environ.get('AWS_REGION', 'us-east-1'),
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        )
    return _bedrock_client


def embed_text(text: str, dimensions: int = 768, cost_tracker: Optional['CostTracker'] = None) -> List[float]:
    """Generate a single embedding using Titan Embed v2.

    Args:
        text: Input text (will be truncated to 8000 chars for safety)
        dimensions: Output dimensions (768 default, Titan v2 supports 256-1024)
        cost_tracker: Optional CostTracker instance to record token usage

    Returns:
        List of floats representing the embedding vector
    """
    client = get_bedrock_client()
    truncated = text[:8000]  # Titan v2 max input is ~8192 tokens

    response = client.invoke_model(
        modelId='amazon.titan-embed-text-v2:0',
        contentType='application/json',
        accept='application/json',
        body=json.dumps({
            'inputText': truncated,
            'dimensions': dimensions,
            'normalize': True,
        }),
    )

    result = json.loads(response['body'].read())

    # Record token usage
    if cost_tracker:
        cost_tracker.record_embedding(len(truncated))

    return result['embedding']


def embed_batch(texts: List[str], dimensions: int = 768, cost_tracker: Optional['CostTracker'] = None) -> List[List[float]]:
    """Generate embeddings for a batch of texts.

    Titan Embed v2 does NOT support native batching — each text
    is a separate API call. We process sequentially to avoid
    rate limits (consistent with the concurrency=5 decision from Phase 1).

    Args:
        texts: List of input texts
        dimensions: Output dimensions (768 default)
        cost_tracker: Optional CostTracker instance to record token usage

    Returns:
        List of embedding vectors (same order as input)
    """
    embeddings = []
    for text in texts:
        embedding = embed_text(text, dimensions, cost_tracker)
        embeddings.append(embedding)
    return embeddings


async def update_chunk_embedding(chunk_id: str, embedding: List[float]):
    """Update a single conversation_chunks row with its embedding vector.

    Uses Supabase REST API PATCH to set the embedding column.
    The embedding is sent as a JSON array which PostgREST converts to vector.
    """
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/conversation_chunks?id=eq.{chunk_id}",
            json={"embedding": embedding},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            timeout=30.0,
        )
        if response.status_code not in (200, 204):
            raise RuntimeError(f"Failed to update embedding for chunk {chunk_id}: {response.status_code}")


async def generate_embeddings_for_chunks(user_id: str, batch_size: int = 50, cost_tracker: Optional['CostTracker'] = None):
    """Generate embeddings for all conversation_chunks that don't have one yet.

    Fetches chunks without embeddings, generates Titan Embed v2 embeddings,
    and PATCHes them back to the database. Processes in batches to limit memory.

    Args:
        user_id: User ID whose chunks need embeddings
        batch_size: Number of chunks to process per batch (default 50)
        cost_tracker: Optional CostTracker instance to record token usage

    Returns:
        Number of chunks embedded
    """
    total_embedded = 0
    offset = 0

    while True:
        # Fetch chunks without embeddings
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/conversation_chunks",
                params={
                    "user_id": f"eq.{user_id}",
                    "embedding": "is.null",
                    "select": "id,content",
                    "limit": str(batch_size),
                    "offset": str(offset),
                },
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                },
                timeout=30.0,
            )
            if response.status_code != 200:
                print(f"[Embeddings] Failed to fetch chunks: {response.status_code}")
                break

            chunks = response.json()

        if not chunks:
            break  # No more chunks to process

        print(f"[Embeddings] Processing batch of {len(chunks)} chunks (offset={offset})")

        # Generate embeddings for this batch
        texts = [chunk["content"] for chunk in chunks]
        embeddings = embed_batch(texts, cost_tracker=cost_tracker)  # Sequential Titan v2 calls

        # Update each chunk with its embedding
        for chunk, embedding in zip(chunks, embeddings):
            await update_chunk_embedding(chunk["id"], embedding)

        total_embedded += len(chunks)
        offset += batch_size

    print(f"[Embeddings] Generated {total_embedded} embeddings for user {user_id}")
    return total_embedded
