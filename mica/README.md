# MICA MAB — Vehicle Fleet & Maintenance Management System

Enterprise vehicle fleet & maintenance management SaaS. NestJS + PostgreSQL/Prisma API,
Next.js frontend, pnpm/Turborepo monorepo. Built phase by phase — see
`plans/` history for the roadmap.

## Stack

- **apps/api** — NestJS, Prisma/PostgreSQL, Redis/BullMQ, JWT auth, Swagger docs
- **apps/web** — Next.js (App Router), Tailwind v4, shadcn/ui, React Query
- **packages/shared-types** — Zod schemas & types shared by both apps
- **packages/config** — shared eslint/tsconfig/tailwind-theme presets

## Prerequisites

- Node.js 20+, pnpm (`corepack enable` or `npm i -g pnpm`)
- PostgreSQL 16 and a Redis-protocol server, reachable locally

This machine already has PostgreSQL 16 and Git installed system-wide, plus a
**project-local, no-admin-required dev Postgres + Redis pair** (separate from
any system Postgres services) started via:

```powershell
./scripts/dev-infra-start.ps1   # starts Postgres on :5434, Redis on :6379
./scripts/dev-infra-stop.ps1    # stops them
```

`apps/api/.env` is already pointed at these (`DATABASE_URL` on port 5434,
`REDIS_URL` on port 6379). If you later set up Docker Desktop, `docker/docker-compose.yml`
runs the equivalent stack (Postgres on the standard :5432, Redis on :6379, plus
a Maildev SMTP catcher) — update `.env` accordingly if you switch to it.

## Getting started

```powershell
pnpm install
pnpm --filter @mica-mab/api prisma:generate
pnpm --filter @mica-mab/api prisma:migrate
pnpm dev   # runs api (http://localhost:4000, docs at /api/docs) and web (http://localhost:3001)
```

## Scripts

- `pnpm dev` — run all apps in dev mode (Turborepo)
- `pnpm build` — build all apps/packages
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — run across the workspace
