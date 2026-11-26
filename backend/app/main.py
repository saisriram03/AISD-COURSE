from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import admin, assignments, auth, calendar, constraints, courses, faculty, notifications, super_admin, timetable
from app.core.config import get_settings
from app.db.base import Base, SessionLocal, engine
from app.db.migrations import ensure_schema_columns
from app.db.seed import seed_database


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns(engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


settings = get_settings()

app = FastAPI(
    title="SMARTSCHED API",
    version="0.2.0",
    description="Intelligent University Timetable & Resource Scheduling Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(super_admin.router, prefix="/api/v1")
app.include_router(timetable.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(constraints.router, prefix="/api/v1")
app.include_router(faculty.router, prefix="/api/v1")
app.include_router(courses.router, prefix="/api/v1")
app.include_router(assignments.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")


@app.get("/api/v1/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "environment": settings.APP_ENV}
