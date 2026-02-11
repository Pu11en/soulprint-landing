"""
Cost Tracker
Accumulates token usage and computes dollar costs during a full pass pipeline.
"""
from typing import Dict, Any


class CostTracker:
    """Accumulates token usage and computes dollar costs during a full pass pipeline."""

    # Pricing per 1M tokens (as of 2025, Haiku 4.5 on Anthropic API)
    HAIKU_INPUT_COST_PER_M = 1.00   # $1.00 per 1M input tokens
    HAIKU_OUTPUT_COST_PER_M = 5.00  # $5.00 per 1M output tokens
    # Titan Embed v2 pricing (AWS Bedrock)
    TITAN_EMBED_COST_PER_M = 0.02   # $0.02 per 1M input tokens (no output)

    def __init__(self):
        """Initialize cost tracker with zero counters."""
        self.llm_input_tokens: int = 0
        self.llm_output_tokens: int = 0
        self.llm_call_count: int = 0
        self.embedding_input_tokens: int = 0
        self.embedding_call_count: int = 0

    def record_llm_call(self, response: Any) -> None:
        """
        Record token usage from an Anthropic API response.

        Args:
            response: Anthropic API response object with .usage attribute
        """
        if hasattr(response, 'usage'):
            self.llm_input_tokens += response.usage.input_tokens
            self.llm_output_tokens += response.usage.output_tokens
            self.llm_call_count += 1

    def record_embedding(self, text_length: int) -> None:
        """
        Record an embedding call with estimated token count.

        Args:
            text_length: Character length of embedded text (tokens estimated as length // 4)
        """
        self.embedding_input_tokens += text_length // 4
        self.embedding_call_count += 1

    def get_summary(self) -> Dict[str, Any]:
        """
        Get a JSON-serializable summary of all costs.

        Returns:
            Dict with token counts, call counts, and computed costs in USD
        """
        llm_cost_usd = (
            self.llm_input_tokens * self.HAIKU_INPUT_COST_PER_M +
            self.llm_output_tokens * self.HAIKU_OUTPUT_COST_PER_M
        ) / 1_000_000

        embedding_cost_usd = (
            self.embedding_input_tokens * self.TITAN_EMBED_COST_PER_M
        ) / 1_000_000

        total_cost_usd = llm_cost_usd + embedding_cost_usd

        return {
            "llm_input_tokens": self.llm_input_tokens,
            "llm_output_tokens": self.llm_output_tokens,
            "llm_call_count": self.llm_call_count,
            "embedding_input_tokens": self.embedding_input_tokens,
            "embedding_call_count": self.embedding_call_count,
            "llm_cost_usd": llm_cost_usd,
            "embedding_cost_usd": embedding_cost_usd,
            "total_cost_usd": total_cost_usd,
        }
