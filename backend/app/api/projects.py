from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, HttpUrl
from app.core.database import get_db
from app.core.security import get_current_user
from app.services.project_service import (
    get_projects_for_user, get_project, create_project,
    delete_project, get_project_history
)
from app.models.models import User, Project, KeywordReport, BlogPost, AgentRun

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str
    url: str
    description: str = ""


def _project_dict(p: Project) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "url": p.url,
        "description": p.description or "",
        "last_analyzed": p.last_analyzed.isoformat() if p.last_analyzed else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _keyword_dict(k: KeywordReport) -> dict:
    return {
        "id": str(k.id),
        "keyword": k.keyword,
        "search_volume": k.search_volume,
        "difficulty": k.difficulty,
        "cpc": k.cpc,
        "intent": k.intent,
        "score": k.score,
        "position": k.position,
        "created_at": k.created_at.isoformat() if k.created_at else None,
    }


def _blog_dict(b: BlogPost) -> dict:
    return {
        "id": str(b.id),
        "title": b.title,
        "meta_description": b.meta_description,
        "content": b.content,
        "keywords_used": b.keywords_used or [],
        "word_count": b.word_count,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


def _run_dict(r: AgentRun) -> dict:
    return {
        "id": str(r.id),
        "status": r.status.value,
        "current_step": r.current_step,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "tokens_used": r.tokens_used,
        "error_message": r.error_message,
    }


@router.get("/")
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = await get_projects_for_user(db, str(current_user.id))
    return [_project_dict(p) for p in projects]


@router.post("/", status_code=201)
async def create_new_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ensure URL has scheme
    url = data.url
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    project = await create_project(db, str(current_user.id), data.name, url, data.description)
    return _project_dict(project)


@router.get("/{project_id}")
async def get_single_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await get_project(db, project_id, str(current_user.id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_dict(project)


@router.delete("/{project_id}", status_code=204)
async def remove_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await delete_project(db, project_id, str(current_user.id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_id}/history")
async def project_history(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await get_project_history(db, project_id, str(current_user.id))
    if not data:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "project": _project_dict(data["project"]),
        "runs": [_run_dict(r) for r in data["runs"]],
        "keywords": [_keyword_dict(k) for k in data["keywords"]],
        "blogs": [_blog_dict(b) for b in data["blogs"]],
    }
