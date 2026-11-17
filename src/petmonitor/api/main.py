"""FastAPI application entry point for the PetMonitor AI local server.

Security note: binds to 127.0.0.1 only. Never set host to 0.0.0.0
without adding authentication — see docs/guides/security.md.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from petmonitor.api.admin_routes import router as admin_router
from petmonitor.api.deps import close_db, init_db
from petmonitor.api.routes import router


def _load_config() -> dict:  # pragma: no cover
    import yaml

    with open("configs/app.yaml") as fh:
        return yaml.safe_load(fh)  # type: ignore[return-value]


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    cfg = _load_config()  # pragma: no cover
    db_path = Path(cfg.get("storage", {}).get("db_path", "data/petmonitor.db"))  # pragma: no cover
    app.state.config = cfg  # pragma: no cover
    init_db(db_path)  # pragma: no cover
    yield  # pragma: no cover
    close_db()  # pragma: no cover


app = FastAPI(
    title="PetMonitor AI",
    description="Local pet activity monitoring API (localhost only).",
    version="0.0.1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")


def main() -> None:  # pragma: no cover
    uvicorn.run(
        "petmonitor.api.main:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
    )
