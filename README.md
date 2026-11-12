# SmartDocs B2B

Initial monorepo for a B2B SaaS platform focused on intelligent document analysis and chat, designed for enterprise teams such as legal, finance, and HR.

## Project structure

- `apps/web`: Next.js frontend
- `apps/api`: NestJS backend
- `apps/worker`: asynchronous processing with BullMQ
- `packages/db`: database schema and client (Drizzle)
- `packages/shared`: shared types and utilities
- `packages/ui`: reusable UI components
- `packages/config`: shared linting and TypeScript configuration

## Root scripts

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Main stack

- `Next.js` for the frontend and dashboard
- `NestJS` for the business API layer
- `PostgreSQL + Drizzle + pgvector` for persistence and embeddings
- `BullMQ + Redis` for asynchronous jobs
- `TurboRepo + pnpm workspaces` for monorepo orchestration

## Next steps

1. Bootstrap `apps/web` with Next.js.
2. Bootstrap `apps/api` with NestJS.
3. Configure the worker and queue pipeline in `apps/worker`.
4. Design the multitenant schema in `packages/db`.

## Local PostgreSQL

Start the local PostgreSQL instance with pgvector:

```bash
docker compose up -d postgres
pnpm --filter @smartdocs/db db:migrate
```

Stop it with:

```bash
docker compose down
```

The API requires `DATABASE_URL` and `JWT_SECRET` environment variables. For local
development, use the PostgreSQL URL from `docker-compose.yml` and a long random
value for `JWT_SECRET`.

Login with `POST /api/auth/login` to receive a JWT, then send it as:

```text
Authorization: Bearer <access-token>
```

Organizations are tenant-scoped: users only see organizations where they have a
membership. The user who creates an organization becomes its `admin`
automatically. Only organization admins can add memberships; members can list
the members of organizations they belong to.

Documents are currently created as metadata records through
`POST /api/documents`. The request includes the organization, original file
name, storage key, MIME type, and size. Uploading to object storage and
asynchronous processing will be added next.