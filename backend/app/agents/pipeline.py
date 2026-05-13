from typing import TypedDict, Annotated, AsyncGenerator
from langgraph.graph import StateGraph, END
from datetime import datetime, timezone
import asyncio

from app.agents.browser_agent import scrape_website
from app.agents.keyword_agent import extract_candidate_keywords, fetch_keyword_data, score_keywords
from app.agents.blog_agent import generate_blog_post


class AgentState(TypedDict):
    # Input
    url: str
    project_id: str
    run_id: str

    # Intermediate
    scraped_data: dict
    candidate_keywords: list
    keyword_data: list

    # Output
    scored_keywords: list
    blog_post: dict

    # Meta
    status: str
    current_step: str
    error: str
    steps_log: list
    tokens_used: int


def _log(state: AgentState, message: str) -> dict:
    log = state.get("steps_log", [])
    log.append({"ts": datetime.now(timezone.utc).isoformat(), "msg": message})
    return {"steps_log": log}


async def node_scrape(state: AgentState) -> dict:
    try:
        updates = _log(state, f"🌐 Scraping {state['url']}...")
        updates["current_step"] = "scraping"
        scraped = await scrape_website(state["url"])
        updates["scraped_data"] = scraped
        updates.update(_log({**state, **updates}, f"✅ Scraped: {scraped.get('title', 'No title')}"))
        return updates
    except Exception as e:
        return {"error": str(e), "status": "failed", "current_step": "scraping"}


async def node_extract_keywords(state: AgentState) -> dict:
    try:
        updates = _log(state, "🔍 Extracting keyword candidates with AI...")
        updates["current_step"] = "extracting_keywords"
        candidates = await extract_candidate_keywords(state["scraped_data"])
        updates["candidate_keywords"] = candidates
        updates.update(_log({**state, **updates}, f"✅ Found {len(candidates)} keyword candidates"))
        return updates
    except Exception as e:
        return {"error": str(e), "status": "failed", "current_step": "extracting_keywords"}


async def node_fetch_seo_data(state: AgentState) -> dict:
    try:
        updates = _log(state, "📊 Fetching SEO metrics for keywords...")
        updates["current_step"] = "fetching_seo_data"
        keyword_data = await fetch_keyword_data(state["candidate_keywords"])
        scored = score_keywords(keyword_data)
        updates["keyword_data"] = keyword_data
        updates["scored_keywords"] = scored
        updates.update(_log({**state, **updates}, f"✅ Scored {len(scored)} keywords by SEO opportunity"))
        return updates
    except Exception as e:
        return {"error": str(e), "status": "failed", "current_step": "fetching_seo_data"}


async def node_generate_blog(state: AgentState) -> dict:
    try:
        updates = _log(state, "✍️ Generating SEO blog post with AI...")
        updates["current_step"] = "generating_blog"
        top_keywords = state["scored_keywords"][:10]
        blog = await generate_blog_post(state["scraped_data"], top_keywords)
        updates["blog_post"] = blog
        updates.update(_log({**state, **updates}, f"✅ Blog post written: {blog.get('word_count', 0)} words"))
        return updates
    except Exception as e:
        return {"error": str(e), "status": "failed", "current_step": "generating_blog"}


async def node_finalize(state: AgentState) -> dict:
    updates = _log(state, "🎉 Analysis complete! Saving results...")
    updates["current_step"] = "completed"
    updates["status"] = "completed"
    return updates


def should_continue(state: AgentState) -> str:
    if state.get("status") == "failed" or state.get("error"):
        return "end"
    return "continue"


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("scrape", node_scrape)
    graph.add_node("extract_keywords", node_extract_keywords)
    graph.add_node("fetch_seo_data", node_fetch_seo_data)
    graph.add_node("generate_blog", node_generate_blog)
    graph.add_node("finalize", node_finalize)

    graph.set_entry_point("scrape")

    graph.add_conditional_edges("scrape", should_continue, {"continue": "extract_keywords", "end": END})
    graph.add_conditional_edges("extract_keywords", should_continue, {"continue": "fetch_seo_data", "end": END})
    graph.add_conditional_edges("fetch_seo_data", should_continue, {"continue": "generate_blog", "end": END})
    graph.add_conditional_edges("generate_blog", should_continue, {"continue": "finalize", "end": END})
    graph.add_edge("finalize", END)

    return graph.compile()


# Singleton compiled graph
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph


async def run_agent_pipeline(url: str, project_id: str, run_id: str) -> AsyncGenerator[dict, None]:
    """Run the full pipeline and yield state updates as SSE events."""
    graph = get_graph()

    initial_state = AgentState(
        url=url,
        project_id=project_id,
        run_id=run_id,
        scraped_data={},
        candidate_keywords=[],
        keyword_data=[],
        scored_keywords=[],
        blog_post={},
        status="running",
        current_step="starting",
        error="",
        steps_log=[],
        tokens_used=0,
    )

    current_state = initial_state.copy()
    async for event in graph.astream(initial_state):
        for node_name, node_state in event.items():
            current_state.update(node_state)
            update = {
                "node": node_name,
                "step": node_state.get("current_step", ""),
                "log": node_state.get("steps_log", []),
                "status": node_state.get("status", "running"),
                "error": node_state.get("error", ""),
            }
            yield update

    yield {"node": "done", "step": "done", "status": "completed", "final_state": current_state}
