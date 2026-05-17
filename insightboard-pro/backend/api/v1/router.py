from fastapi import APIRouter

from api.routes import ai, auth, dashboards, datasets, live, websocket
from api.v1.endpoints import health

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["dashboards"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(live.router, prefix="/live", tags=["live"])
api_router.include_router(websocket.router, prefix="/ws", tags=["websocket"])
