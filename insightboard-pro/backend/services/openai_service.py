from openai import AsyncOpenAI

from core.config import get_settings

settings = get_settings()


def get_openai_client() -> AsyncOpenAI | None:
    if not settings.openai_api_key:
        return None
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def generate_insight(prompt: str) -> str:
    client = get_openai_client()
    if client is None:
        return "OpenAI API key not configured."

    response = await client.chat.completions.create(
        model=settings.openai_model,
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
