"""LLM client — Groq (OpenAI-compatible) with optional OpenAI fallback."""

from openai import AsyncOpenAI

from core.config import get_settings

settings = get_settings()

GROQ_DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"


def get_llm_provider() -> str:
    """Returns 'groq', 'openai', or empty if not configured."""
    if settings.groq_api_key:
        return "groq"
    if settings.openai_api_key:
        return "openai"
    return ""


def get_llm_model() -> str:
    if settings.groq_api_key:
        return settings.groq_model
    return settings.openai_model


def get_openai_client() -> AsyncOpenAI | None:
    """Returns an AsyncOpenAI client for Groq or OpenAI (backward-compatible name)."""
    if settings.groq_api_key:
        return AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url or GROQ_DEFAULT_BASE_URL,
        )
    if settings.openai_api_key:
        return AsyncOpenAI(api_key=settings.openai_api_key)
    return None


async def generate_insight(prompt: str) -> str:
    client = get_openai_client()
    if client is None:
        return "LLM API key not configured. Set GROQ_API_KEY in .env."

    response = await client.chat.completions.create(
        model=get_llm_model(),
        messages=[
            {
                "role": "system",
                "content": "You are an analytics assistant for InsightBoard.",
            },
            {"role": "user", "content": prompt},
        ],
        max_tokens=500,
    )
    return response.choices[0].message.content or ""
