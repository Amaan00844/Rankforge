from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
from app.core.config import get_settings

settings = get_settings()


def _build_async_url(url: str) -> tuple[str, dict]:
    """
    Convert a DATABASE_URL to asyncpg-compatible format.
    - Replace postgres:// or postgresql:// with postgresql+asyncpg://
    - Strip sslmode from the query string (asyncpg uses ssl=True connect arg)
    Returns (cleaned_url, connect_args).
    """
    # Ensure asyncpg dialect
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    parsed = urlparse(url)
    params = parse_qs(parsed.query)

    # Pull out sslmode before asyncpg chokes on it
    sslmode = params.pop("sslmode", [None])[0]

    new_query = urlencode({k: v[0] for k, v in params.items()})
    cleaned = urlunparse(parsed._replace(query=new_query))

    # Determine connect_args
    connect_args: dict = {}
    is_local = parsed.hostname in ("localhost", "127.0.0.1", "::1")
    if not is_local and sslmode in ("require", "verify-ca", "verify-full", None):
        # Cloud Postgres (Neon, Supabase, etc.) always needs SSL
        connect_args["ssl"] = True

    return cleaned, connect_args


_db_url, _connect_args = _build_async_url(settings.DATABASE_URL)

engine = create_async_engine(
    _db_url,
    connect_args=_connect_args,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    echo=settings.APP_ENV == "development",
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
