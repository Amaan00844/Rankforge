import httpx
import json
import re
from app.services.llm_client import chat_completion
from app.core.config import get_settings

settings = get_settings()


async def extract_candidate_keywords(scraped_data: dict) -> list[str]:
    """Use LLM to extract keyword candidates from scraped content."""
    prompt_content = f"""
You are an expert SEO strategist. Analyze this website content and extract the most relevant SEO keyword candidates.

Website Title: {scraped_data.get('title', '')}
Meta Description: {scraped_data.get('meta_description', '')}
H1 Tags: {', '.join(scraped_data.get('h1', [])[:5])}
H2 Tags: {', '.join(scraped_data.get('h2', [])[:10])}
Products/Services: {', '.join(scraped_data.get('products', [])[:15])}
Body excerpt: {scraped_data.get('body_text', '')[:1000]}

Extract 20-30 high-value SEO keywords and phrases this website should target for Google ranking.
Focus on:
1. Product/service keywords (commercial intent)
2. Problem-solving keywords (informational)
3. Comparison keywords (transactional)
4. Long-tail variations

Return ONLY a JSON array of keyword strings, no explanation.
Example: ["keyword one", "keyword two", "long tail keyword phrase"]
"""
    response = await chat_completion(
        messages=[{"role": "user", "content": prompt_content}],
        temperature=0.3,
        max_tokens=1024,
    )
    raw = response.choices[0].message.content.strip()

    # Parse JSON safely
    try:
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            keywords = json.loads(match.group())
            return [k.strip() for k in keywords if isinstance(k, str) and k.strip()]
    except Exception:
        pass

    # Fallback: split by newlines
    lines = [l.strip().strip('"').strip("'").strip(',') for l in raw.split('\n')]
    return [l for l in lines if 3 < len(l) < 100][:30]


async def fetch_keyword_data(keywords: list[str]) -> list[dict]:
    """
    Fetch real SEO data from SerpAPI for each keyword.
    Falls back to LLM-estimated data if no API key.
    """
    if settings.SERPAPI_KEY:
        return await _fetch_from_serpapi(keywords)
    else:
        return await _estimate_keyword_data(keywords)


import asyncio

async def _fetch_from_serpapi(keywords: list[str]) -> list[dict]:
    async def fetch_single(client: httpx.AsyncClient, keyword: str) -> dict:
        try:
            params = {
                "engine": "google",
                "q": keyword,
                "api_key": settings.SERPAPI_KEY,
                "num": 10,
            }
            resp = await client.get("https://serpapi.com/search", params=params)
            resp.raise_for_status()
            data = resp.json()

            # Extract related searches as additional signals
            related = data.get("related_searches", [])
            
            return {
                "keyword": keyword,
                "search_volume": _estimate_volume_from_serp(data),
                "difficulty": _estimate_difficulty(data),
                "cpc": 0.0,
                "intent": _classify_intent(keyword),
                "related": [r.get("query", "") for r in related[:5]],
            }
        except Exception:
            return _fallback_keyword_entry(keyword)

    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [fetch_single(client, keyword) for keyword in keywords[:25]]
        results = await asyncio.gather(*tasks)
        
    return list(results)


async def _estimate_keyword_data(keywords: list[str]) -> list[dict]:
    """Use LLM to estimate keyword metrics when no API key available."""
    keywords_str = "\n".join(f"- {kw}" for kw in keywords[:25])
    prompt = f"""
You are an SEO expert. Estimate realistic SEO metrics for these keywords.

Keywords:
{keywords_str}

For each keyword, provide estimated metrics based on typical Google search patterns.
Return ONLY valid JSON array:
[
  {{
    "keyword": "keyword text",
    "search_volume": 1200,
    "difficulty": 45,
    "cpc": 1.50,
    "intent": "commercial"
  }}
]

Intent must be one of: informational, commercial, transactional, navigational
search_volume: monthly searches (integer)
difficulty: 0-100 (integer)
cpc: cost per click in USD (float)
"""
    response = await chat_completion(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=2048,
    )
    raw = response.choices[0].message.content.strip()
    try:
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
            results = []
            for item in data:
                if isinstance(item, dict) and "keyword" in item:
                    results.append({
                        "keyword": str(item.get("keyword", "")),
                        "search_volume": int(item.get("search_volume", 100)),
                        "difficulty": float(item.get("difficulty", 50)),
                        "cpc": float(item.get("cpc", 0.5)),
                        "intent": str(item.get("intent", "informational")),
                        "related": [],
                    })
            return results
    except Exception:
        pass
    return [_fallback_keyword_entry(kw) for kw in keywords]


def _fallback_keyword_entry(keyword: str) -> dict:
    return {
        "keyword": keyword,
        "search_volume": 500,
        "difficulty": 50.0,
        "cpc": 1.0,
        "intent": _classify_intent(keyword),
        "related": [],
    }


def _estimate_volume_from_serp(data: dict) -> int:
    total_results = data.get("search_information", {}).get("total_results", 0)
    if total_results > 1_000_000_000:
        return 10000
    elif total_results > 100_000_000:
        return 5000
    elif total_results > 10_000_000:
        return 1000
    return 500


def _estimate_difficulty(data: dict) -> float:
    organic = data.get("organic_results", [])
    has_big_domains = any(
        any(d in str(r.get("link", "")) for d in ["wikipedia", "amazon", "reddit", "youtube"])
        for r in organic[:5]
    )
    return 75.0 if has_big_domains else 45.0


def _classify_intent(keyword: str) -> str:
    kw_lower = keyword.lower()
    transactional = ["buy", "price", "cheap", "discount", "order", "shop", "deal", "cost", "purchase"]
    commercial = ["best", "top", "review", "vs", "compare", "alternative", "recommend"]
    navigational = ["login", "sign in", "website", "official", "contact"]
    if any(w in kw_lower for w in transactional):
        return "transactional"
    if any(w in kw_lower for w in commercial):
        return "commercial"
    if any(w in kw_lower for w in navigational):
        return "navigational"
    return "informational"


def score_keywords(keyword_data: list[dict]) -> list[dict]:
    """Score and rank keywords by SEO opportunity."""
    for kw in keyword_data:
        volume = kw.get("search_volume", 0)
        difficulty = kw.get("difficulty", 100)
        cpc = kw.get("cpc", 0)
        intent_boost = {"transactional": 1.3, "commercial": 1.2, "informational": 1.0, "navigational": 0.8}
        boost = intent_boost.get(kw.get("intent", "informational"), 1.0)
        kw["score"] = round((volume * (1 - difficulty / 100) * boost + cpc * 100) * boost, 2)

    keyword_data.sort(key=lambda x: x["score"], reverse=True)
    for i, kw in enumerate(keyword_data):
        kw["position"] = i + 1
    return keyword_data
