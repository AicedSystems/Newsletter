# Project Instructions

## Product
Custom publishing/newsletter platform for a real estate team leader.

## Stack
- Flask
- Python
- HTML/CSS
- Vanilla JavaScript
- SQLAlchemy
- SQLite for development
- PostgreSQL/Supabase planned for production

## Development Method
Use vertical slices.

Do not build unrelated future features.

Current Phase:
Phase 1 — Publishing Foundation

## Completed
- Dashboard UI
- Create Post UI
- Campaign UI
- Local publishing MVP
- Drafts in localStorage
- Published posts appear in dashboard
- Article detail modal

## Current Goal
Replace localStorage persistence with Flask + SQLAlchemy.

## Database Strategy

- SQLAlchemy is the ORM.
- SQLite is temporary and used only for initial local development/learning.
- Production database will be PostgreSQL hosted with Supabase.
- Do not introduce SQLite-specific application logic.
- Do not migrate to PostgreSQL/Supabase until explicitly requested.

## Rules
- Preserve existing UI unless explicitly asked.
- Do not rewrite files unnecessarily.
- Reuse existing functions.
- Prefer small modules.
- Explain architectural changes.
- Do not add dependencies without explaining why.
- Never implement future phases unless requested.
- Run relevant tests/checks after modifications.
- Report every file changed.