# Roadtrip

**Discover a trip. Follow the route. Make it your own.**

A community platform for sharing road trip itineraries — with stops, photos, tips and the real driving route — that anyone can recreate with one click and customize.

## Repo layout

```
apps/
  api/        Express + TypeScript + Prisma (PostgreSQL)
  web/        React + TypeScript + Vite + MapLibre
packages/
  shared/     Zod schemas + types: the API contract both apps import
```

| Lane | Owns |
| --- | --- |
| 1 · Maps & Trip Editor | `apps/web/src/components/map`, `apps/web/src/pages/TripEditorPage.tsx` |
| 2 · App Shell & Browsing | `apps/web/src/pages`, `apps/web/src/components` |
| 3 · Core API & Database | `apps/api/src/routes`, `apps/api/prisma` |
| 4 · Integrations & Deploy | `apps/api/src/services`, CI, hosting |
| Everyone | `packages/shared` — change the contract here first |

## Quick start

Requirements: Node 22+, Docker (or any PostgreSQL 16).

```bash
npm install
docker compose up -d                       # local Postgres
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run dev                                # API on :4000, web on :5173
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web with hot reload |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm test` | API tests |
| `npm run build` | Production build of the web app |
