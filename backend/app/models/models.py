import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, DateTime, Boolean, Integer, Float,
    Text, ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


def now_utc():
    return datetime.now(timezone.utc)


class PlanTier(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    AGENCY = "agency"


class RunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    plan = Column(SAEnum(PlanTier), default=PlanTier.FREE, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    last_login = Column(DateTime(timezone=True), nullable=True)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    user = relationship("User", back_populates="refresh_tokens")


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    url = Column(String(2048), nullable=False)
    description = Column(Text, nullable=True)
    last_analyzed = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    owner = relationship("User", back_populates="projects")
    agent_runs = relationship("AgentRun", back_populates="project", cascade="all, delete-orphan")
    keyword_reports = relationship("KeywordReport", back_populates="project", cascade="all, delete-orphan")
    blog_posts = relationship("BlogPost", back_populates="project", cascade="all, delete-orphan")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SAEnum(RunStatus), default=RunStatus.PENDING, nullable=False)
    current_step = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    tokens_used = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), default=now_utc)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship("Project", back_populates="agent_runs")


class KeywordReport(Base):
    __tablename__ = "keyword_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id = Column(UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True)
    keyword = Column(String(500), nullable=False)
    search_volume = Column(Integer, default=0)
    difficulty = Column(Float, default=0.0)
    cpc = Column(Float, default=0.0)
    intent = Column(String(50), nullable=True)  # informational, commercial, transactional
    score = Column(Float, default=0.0)
    position = Column(Integer, default=0)  # rank in report
    created_at = Column(DateTime(timezone=True), default=now_utc)

    project = relationship("Project", back_populates="keyword_reports")


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id = Column(UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(500), nullable=False)
    meta_description = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    keywords_used = Column(JSON, default=list)
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=now_utc)

    project = relationship("Project", back_populates="blog_posts")
