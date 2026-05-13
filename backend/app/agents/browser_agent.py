import asyncio
import httpx
from bs4 import BeautifulSoup
from typing import Optional
import re


async def scrape_website(url: str) -> dict:
    """
    Scrapes a website for SEO-relevant content.
    Returns title, meta description, headings, products, body text.
    Falls back to httpx if playwright unavailable.
    """
    try:
        return await _scrape_with_playwright(url)
    except Exception:
        return await _scrape_with_httpx(url)


async def _scrape_with_playwright(url: str) -> dict:
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = await context.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(2)
            html = await page.content()
            await browser.close()
            return _parse_html(html, url)
    except Exception as e:
        raise RuntimeError(f"Playwright failed: {e}")


async def _scrape_with_httpx(url: str) -> dict:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return _parse_html(response.text, url)


def _parse_html(html: str, url: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    # Remove scripts/styles
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    title = ""
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)

    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag:
        meta_desc = meta_tag.get("content", "")

    meta_keywords = ""
    meta_kw = soup.find("meta", attrs={"name": "keywords"})
    if meta_kw:
        meta_keywords = meta_kw.get("content", "")

    h1s = [h.get_text(strip=True) for h in soup.find_all("h1")]
    h2s = [h.get_text(strip=True) for h in soup.find_all("h2")]
    h3s = [h.get_text(strip=True) for h in soup.find_all("h3")]

    # Find product-like content
    products = _extract_products(soup)

    # Body text (first 3000 chars)
    body_text = soup.get_text(separator=" ", strip=True)
    body_text = re.sub(r'\s+', ' ', body_text)[:3000]

    return {
        "url": url,
        "title": title,
        "meta_description": meta_desc,
        "meta_keywords": meta_keywords,
        "h1": h1s,
        "h2": h2s,
        "h3": h3s,
        "products": products,
        "body_text": body_text,
    }


def _extract_products(soup: BeautifulSoup) -> list[str]:
    products = []
    product_selectors = [
        "[class*='product']", "[class*='item']", "[class*='card']",
        "[data-product]", "[itemprop='name']", "h2", "h3",
    ]
    seen = set()
    for selector in product_selectors:
        for el in soup.select(selector)[:20]:
            text = el.get_text(strip=True)
            if 3 < len(text) < 100 and text not in seen:
                products.append(text)
                seen.add(text)
        if len(products) >= 20:
            break
    return products[:20]
