import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401 — register Profile + Dataset ORM metadata

from api.routes.health import router as health_router
from api.v1.router import api_router
from core.config import get_settings
from core.redis_client import close_redis, ping_redis
from core.redis_listener import listen_dataset_events

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ping_redis()
    stop = asyncio.Event()
    listener = asyncio.create_task(listen_dataset_events(stop))
    yield
    stop.set()
    listener.cancel()
    try:
        await listener
    except asyncio.CancelledError:
        pass
    await close_redis()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
    redirect_slashes=False,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        dict.fromkeys(
            settings.cors_origins_list
            + ["http://127.0.0.1:3000", "http://localhost:3000"]
        )
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs",
    }
