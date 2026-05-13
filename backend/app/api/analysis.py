import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.services.project_service import get_project
from app.agents.pipeline import run_agent_pipeline
from app.models.models import User, AgentRun, KeywordReport, BlogPost, RunStatus, Project

router = APIRouter(prefix="/analyze", tags=["analysis"])


async def _save_results(db: AsyncSession, project_id: str, run_id: str, final_state: dict):
    """Persist agent results to database."""
    try:
        run_uuid = uuid.UUID(run_id)
        project_uuid = uuid.UUID(project_id)

        # Update run status
        result = await db.execute(select(AgentRun).where(AgentRun.id == run_uuid))
        run = result.scalar_one_or_none()
        if run:
            run.status = RunStatus.COMPLETED
            run.finished_at = datetime.now(timezone.utc)
            run.current_step = "completed"

        # Save keywords
        scored_keywords = final_state.get("scored_keywords", [])
        for kw_data in scored_keywords[:30]:
            kw = KeywordReport(
                project_id=project_uuid,
                run_id=run_uuid,
                keyword=kw_data["keyword"],
                search_volume=int(kw_data.get("search_volume", 0)),
                difficulty=float(kw_data.get("difficulty", 0)),
                cpc=float(kw_data.get("cpc", 0)),
                intent=kw_data.get("intent", "informational"),
                score=float(kw_data.get("score", 0)),
                position=int(kw_data.get("position", 0)),
            )
            db.add(kw)

        # Save blog post
        blog = final_state.get("blog_post", {})
        if blog and blog.get("title"):
            blog_row = BlogPost(
                project_id=project_uuid,
                run_id=run_uuid,
                title=blog.get("title", ""),
                meta_description=blog.get("meta_description", ""),
                content=blog.get("content", ""),
                keywords_used=blog.get("keywords_used", []),
                word_count=blog.get("word_count", 0),
            )
            db.add(blog_row)

        # Update project last_analyzed
        proj_result = await db.execute(select(Project).where(Project.id == project_uuid))
        project = proj_result.scalar_one_or_none()
        if project:
            project.last_analyzed = datetime.now(timezone.utc)

        await db.commit()
    except Exception as e:
        print(f"Error saving results: {e}")
        await db.rollback()


@router.post("/{project_id}/run")
async def start_analysis(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start an analysis run and return SSE stream."""
    project = await get_project(db, project_id, str(current_user.id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create run record
    run = AgentRun(
        project_id=uuid.UUID(project_id),
        status=RunStatus.RUNNING,
        current_step="starting",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    run_id = str(run.id)

    async def event_stream():
        final_state = None
        try:
            async for update in run_agent_pipeline(project.url, project_id, run_id):
                if update.get("node") == "done":
                    final_state = update.get("final_state", {})
                else:
                    data = json.dumps({
                        "type": "progress",
                        "step": update.get("step", ""),
                        "log": update.get("log", []),
                        "status": update.get("status", "running"),
                    })
                    yield f"data: {data}\n\n"

            if final_state:
                await _save_results(db, project_id, run_id, final_state)

                # Send final results
                scored_keywords = final_state.get("scored_keywords", [])[:30]
                blog_post = final_state.get("blog_post", {})

                done_data = json.dumps({
                    "type": "completed",
                    "run_id": run_id,
                    "keywords": scored_keywords,
                    "blog_post": blog_post,
                    "keyword_count": len(scored_keywords),
                })
                yield f"data: {done_data}\n\n"
            else:
                # Update run as failed
                result = await db.execute(select(AgentRun).where(AgentRun.id == uuid.UUID(run_id)))
                run_obj = result.scalar_one_or_none()
                if run_obj:
                    run_obj.status = RunStatus.FAILED
                    run_obj.finished_at = datetime.now(timezone.utc)
                await db.commit()
                yield f"data: {json.dumps({'type': 'error', 'message': 'Pipeline failed'})}\n\n"

        except Exception as e:
            error_data = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/{project_id}/runs")
async def list_runs(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await get_project(db, project_id, str(current_user.id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from sqlalchemy import desc
    result = await db.execute(
        select(AgentRun)
        .where(AgentRun.project_id == uuid.UUID(project_id))
        .order_by(desc(AgentRun.started_at))
        .limit(20)
    )
    runs = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "status": r.status.value,
            "current_step": r.current_step,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        }
        for r in runs
    ]
