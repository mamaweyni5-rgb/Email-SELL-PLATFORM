# Email Registration Portal

An app where users submit their email and password credentials via a registration form, and an admin panel lets the operator view all submissions — organized per entry, separately stored.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/main-app run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui, wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- **OpenAPI spec**: `lib/api-spec/openapi.yaml`
- **DB schema**: `lib/db/src/schema/registrations.ts`
- **API routes**: `artifacts/api-server/src/routes/registrations.ts`
- **Frontend pages**: `artifacts/main-app/src/pages/`
  - `home.tsx` — user registration form
  - `admin.tsx` — admin panel with list and stats
- **Generated hooks**: `lib/api-client-react/src/generated/`
- **Generated Zod schemas**: `lib/api-zod/src/generated/`

## Architecture decisions

- Passwords are hashed with SHA-256 before storage (no plain-text storage)
- Email uniqueness is enforced at both DB level (UNIQUE constraint) and API level (409 response)
- Admin panel has no authentication (internal use only)
- Registration success shows inline confirmation — no redirect
- Stats (total, today, week) are computed server-side via SQL aggregates

## Product

- Users land on a clean registration form, enter their email + password, and receive confirmation
- Admin panel at `/admin` shows all registrations in a table with timestamps and per-row delete
- Stats cards show total accounts, registrations today, and registrations this week

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before using updated types
- Do not restart the frontend workflow while the design subagent is running

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
