# SmartDocs B2B

Monorepo inicial para la plataforma SaaS multitenant de analisis inteligente y chat con documentos orientada a empresas.

## Estructura

- `apps/web`: frontend Next.js
- `apps/api`: backend NestJS
- `apps/worker`: procesamiento asincrono con BullMQ
- `packages/db`: esquema y cliente de base de datos (Drizzle)
- `packages/shared`: tipos y utilidades compartidas
- `packages/ui`: componentes reutilizables
- `packages/config`: configuracion compartida (lint/tsconfig)

## Scripts raiz

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

## Stack principal

- `Next.js` para frontend y dashboard
- `NestJS` para API y negocio
- `PostgreSQL + Drizzle + pgvector` para persistencia y embeddings
- `BullMQ + Redis` para trabajos asincronos
- `TurboRepo + pnpm workspaces` para monorepo

## Proximos pasos

1. Bootstrap de Next.js en `apps/web`.
2. Bootstrap de NestJS en `apps/api`.
3. Configurar worker y colas en `apps/worker`.
4. Disenar esquema multitenant en `packages/db`.
