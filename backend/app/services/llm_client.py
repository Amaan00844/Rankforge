from openai import AsyncOpenAI
from app.core.config import get_settings

settings = get_settings()

_client = None


def get_llm_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.NVIDIA_API_KEY,
            base_url=settings.NVIDIA_BASE_URL,
        )
    return _client


async def chat_completion(
    messages: list[dict],
    model: str = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    stream: bool = False,
):
    client = get_llm_client()
    model = model or settings.NVIDIA_MODEL
    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=stream,
    )
    return response
