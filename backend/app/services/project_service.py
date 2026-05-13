from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.models import Project, AgentRun, KeywordReport, BlogPost
import uuid


async def get_projects_for_user(db: AsyncSession, user_id: str) -> list[Project]:
    result = await db.execute(
        select(Project)
        .where(Project.user_id == uuid.UUID(user_id))
        .order_by(desc(Project.created_at))
    )
    return result.scalars().all()


async def get_project(db: AsyncSession, project_id: str, user_id: str) -> Project | None:
    result = await db.execute(
        select(Project).where(
            Project.id == uuid.UUID(project_id),
            Project.user_id == uuid.UUID(user_id),
        )
    )
    return result.scalar_one_or_none()


async def create_project(db: AsyncSession, user_id: str, name: str, url: str, description: str = "") -> Project:
    project = Project(
        user_id=uuid.UUID(user_id),
        name=name,
        url=url,
        description=description,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project_id: str, user_id: str) -> bool:
    project = await get_project(db, project_id, user_id)
    if not project:
        return False
    await db.delete(project)
    return True


async def get_project_history(db: AsyncSession, project_id: str, user_id: str) -> dict:
    project = await get_project(db, project_id, user_id)
    if not project:
        return {}

    runs_result = await db.execute(
        select(AgentRun)
        .where(AgentRun.project_id == uuid.UUID(project_id))
        .order_by(desc(AgentRun.started_at))
        .limit(10)
    )
    runs = runs_result.scalars().all()

    keywords_result = await db.execute(
        select(KeywordReport)
        .where(KeywordReport.project_id == uuid.UUID(project_id))
        .order_by(desc(KeywordReport.created_at))
        .limit(30)
    )
    keywords = keywords_result.scalars().all()

    blogs_result = await db.execute(
        select(BlogPost)
        .where(BlogPost.project_id == uuid.UUID(project_id))
        .order_by(desc(BlogPost.created_at))
    )
    blogs = blogs_result.scalars().all()

    return {
        "project": project,
        "runs": runs,
        "keywords": keywords,
        "blogs": blogs,
    }
