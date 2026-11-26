# SMARTSCHED

**One Campus. Zero Clashes. Smarter Scheduling.**

Intelligent University Timetable & Resource Scheduling Platform powered by Google OR-Tools CP-SAT, explainable conflict diagnosis, minimal-change rescheduling, and an isolated Digital Twin what-if simulator.

## Monorepo Structure

- `frontend/` — React 19, TypeScript (strict), Vite, Tailwind CSS v4, Framer Motion, Zustand, TanStack Query
- `backend/` — FastAPI, Pydantic, SQLAlchemy, Alembic, Google OR-Tools CP-SAT, Celery, Redis *(Phase 3+)*
- `infrastructure/` — Docker, PostgreSQL, Redis configurations *(Phase 3+)*
- `docs/` — Architecture, Database Design, API & Solver Documentation

## Development Progress

- [x] **Phase 1 — Foundation**: Monorepo structure, React + Vite + TS strict, Tailwind CSS v4, Design Tokens, Typography, Motion Presets, SmartCursor, Auth Foundation, Role-based Layouts, Command Palette (`Ctrl+K`)
- [ ] **Phase 2 — Landing Page**
- [ ] **Phase 3 — Backend & Database**
- [ ] **Phase 4 — Master Data**
- [ ] **Phase 5 — Constraint Engine**
- [ ] **Phase 6 — Timetable Grid**
- [ ] **Phase 7 — CP-SAT Optimization**
- [ ] **Phase 8 — Solve Theater**
- [ ] **Phase 9 — Conflict Diagnosis**
- [ ] **Phase 10 — Rescheduling & Swaps**
- [ ] **Phase 11 — Faculty & Student Portals**
- [ ] **Phase 12 — Analytics**
- [ ] **Phase 13 — Digital Twin**
- [ ] **Phase 14 — Final Polish**

## Quick Start (Phase 1 — Frontend)

```bash
cd frontend
npm install
npm run dev
```
