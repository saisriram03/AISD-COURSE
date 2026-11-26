# SMARTSCHED Architecture Overview

## Frontend Architecture
- **Core**: React 19, TypeScript (strict), Vite
- **Styling**: Tailwind CSS v4 + CSS custom property design tokens (`src/styles/tokens.css`)
- **State**: Zustand (client auth session & theme state), TanStack Query (server cache & mutations)
- **Routing**: React Router v7 with role-enforced `<ProtectedRoute>` guards
- **Motion & Cursor**: Framer Motion with `MotionConfig reducedMotion="user"` and desktop fine-pointer `SmartCursor`
- **Forms**: React Hook Form + Zod schema validation

## Backend Architecture (Phase 3+)
- **API**: FastAPI + Pydantic v2 + versioned `/api/v1/*` routes
- **Persistence**: PostgreSQL + SQLAlchemy 2.0 + Alembic migrations
- **Optimization**: Google OR-Tools CP-SAT isolated in `backend/app/solver/`
- **Async Tasks & Streaming**: Celery + Redis + WebSockets / Server-Sent Events
