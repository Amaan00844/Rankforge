import json
import re
from app.services.llm_client import chat_completion


async def generate_blog_post(scraped_data: dict, top_keywords: list[dict]) -> dict:
    """Generate a full SEO-optimized blog post using the LLM."""

    primary_kw = top_keywords[0]["keyword"] if top_keywords else scraped_data.get("title", "")
    secondary_kws = [k["keyword"] for k in top_keywords[1:6]]
    products = scraped_data.get("products", [])[:8]
    site_title = scraped_data.get("title", "")
    meta_desc = scraped_data.get("meta_description", "")
    url = scraped_data.get("url", "")

    system_prompt = """You are a senior SEO content strategist and professional blog writer for a top marketing agency. 
You write compelling, search-engine-optimized blog posts that rank on Google's first page. 
Your writing is engaging, authoritative, and naturally incorporates target keywords without stuffing.
Always respond with valid JSON only."""

    user_prompt = f"""Write a comprehensive SEO blog post for this website.

Website: {url}
Site Title: {site_title}
Business Description: {meta_desc}
Products/Services: {', '.join(products)}

Primary Keyword (must appear in H1, first paragraph, and conclusion): {primary_kw}
Secondary Keywords (use naturally 2-3 times each): {', '.join(secondary_kws)}

Requirements:
- Word count: 1200-1500 words
- Structure: H1 title, introduction, 4-5 H2 sections, conclusion with CTA
- Include the primary keyword in the first 100 words
- Meta description: exactly 150-160 characters
- Tone: professional yet approachable
- Include actionable tips and value for the reader
- End with a strong call-to-action

Return ONLY this JSON structure (no markdown, no explanation):
{{
  "title": "H1 title with primary keyword",
  "meta_description": "150-160 char meta description",
  "content": "Full blog post in markdown format with ## H2 headings",
  "keywords_used": ["list", "of", "keywords", "used"],
  "word_count": 1250
}}"""

    response = await chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=3000,
    )

    raw = response.choices[0].message.content.strip()

    # Clean and parse JSON
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'^```\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)

    try:
        result = json.loads(raw)
        result["word_count"] = len(result.get("content", "").split())
        return result
    except Exception:
        # Try to extract JSON object
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group())
                result["word_count"] = len(result.get("content", "").split())
                return result
            except Exception:
                pass

    # Final fallback
    return {
        "title": f"Complete Guide to {primary_kw}",
        "meta_description": f"Discover everything about {primary_kw}. Expert insights and tips for {site_title}.",
        "content": raw,
        "keywords_used": [primary_kw] + secondary_kws,
        "word_count": len(raw.split()),
    }
