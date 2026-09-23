# Lumili Local Development Setup

This guide explains how to run Lumili, the childcare management platform,
locally.

## Modules and services

The project is organized as a frontend, an API gateway, backend microservices,
and shared packages. Each backend service owns its own domain logic, routes,
data, and tests.

### Frontend and platform applications

| Module | Location | Purpose |
| --- | --- | --- |
| Web frontend | `apps/web` | Next.js browser application. Provides the user interface and communicates with the backend through HTTP APIs. |
| API gateway | `apps/gateway` | Public backend entry point. Provides the API boundary, service registry, health endpoint, and future request proxying, authentication context, rate limiting, and observability. |

The frontend should not import implementation files from `services/**` or
`apps/gateway/**`. It should call the gateway API through the frontend API
client.

### Backend microservices

| Module | Location | Purpose |
| --- | --- | --- |
| Identity | `services/identity` | Authentication, users, tenants, memberships, roles, permissions, password hashing, access tokens, and tenant context. |
| Children | `services/children` | Child profiles, guardian relationships, emergency contacts, and child-related records. |
| Enrollment | `services/enrollment` | Enrollment applications, childcare placement, program assignment, and enrollment status workflows. |
| Attendance | `services/attendance` | Check-in/check-out events, attendance history, schedules, and attendance reporting. |
| Billing | `services/billing` | Invoices, fees, payment records, balances, and billing status. |
| Notifications | `services/notifications` | Email, in-app, and operational notifications sent by the platform. |

Each service is independently runnable and has its own `src/routes`,
`src/plugins`, and `test` directories. As a service grows, domain code should
be placed under `src/modules/<module>`.

### Shared packages

| Package | Location | Purpose |
| --- | --- | --- |
| Shared contracts | `packages/shared` | Transport-safe TypeScript types and constants shared across applications, such as service names and tenant authentication context. |
| Shared configuration | `packages/config` | Configuration primitives that can be shared without importing service implementation code. |

### Identity and authorization concepts

The identity service is the foundation for multi-tenancy and RBAC:

```text
User
  |
  +-- Membership -- Tenant
          |
          +-- Role
```

- A **user** is a person who can authenticate.
- A **tenant** is an independent childcare organization or center.
- A **membership** connects a user to a tenant.
- A **role** controls what the user can do within that tenant.
- A **permission** represents an allowed operation, such as reading tenant data
  or managing members.

The same user can belong to multiple tenants with different roles. Backend
services must derive the active tenant from the authenticated request context
and verify membership before accessing tenant-owned data.

## Adding new backend modules

Add a new domain module to the service that owns the domain. Do not place
business logic in the gateway or in another service.

Example: adding a `reports` module to the attendance service:

```text
services/attendance/src/modules/reports/
  reports.repository.ts
  reports.service.ts
  reports.types.ts
services/attendance/src/routes/reports.ts
services/attendance/test/routes/reports.test.ts
```

Recommended responsibilities:

| File | Responsibility |
| --- | --- |
| `*.types.ts` | Domain input, output, and internal types |
| `*.repository.ts` | Database reads and writes |
| `*.service.ts` | Business rules and use cases |
| `src/routes/*.ts` | HTTP validation, authentication, authorization, and response mapping |
| `test/**` | Unit and route/integration tests |

When implementing a tenant-owned module:

1. Authenticate the request.
2. Read the tenant from the trusted authentication context.
3. Verify the user has the required role or permission.
4. Scope every query by `tenantId`.
5. Never trust a tenant ID supplied only in the request body or URL.
6. Add tests proving data from one tenant cannot be read by another tenant.

For an RBAC-protected route, use the identity authorization decorator pattern:

```ts
fastify.get(
  '/reports',
  {
    preHandler: [
      fastify.authenticate,
      fastify.authorize('tenant:read')
    ]
  },
  async (request) => {
    return reportsService.listForTenant(request.auth!.tenantId)
  }
)
```

## Adding frontend components

Place reusable browser components in the web application:

```text
apps/web/src/components/
  Button.tsx
  TenantSwitcher.tsx
  DataTable.tsx
```

Place route-specific UI with the route:

```text
apps/web/src/app/
  login/page.tsx
  tenants/[tenantId]/page.tsx
```

Use these rules:

1. Keep server and client components separate.
2. Add `"use client"` only when a component needs browser state, events, or
   browser-only APIs.
3. Keep API calls in `apps/web/src/lib/` rather than embedding fetch logic in
   every component.
4. Call the gateway, not an individual backend service.
5. Do not import backend repositories, Prisma clients, or service plugins into
   the frontend.
6. Add loading, error, and unauthorized states for authenticated screens.
7. Hide tenant-specific navigation and actions unless the current role allows
   them; backend authorization remains mandatory.

## Adding a shared contract

Add only transport-safe types and constants to:

```text
packages/shared/src/index.ts
```

Good shared exports include API request/response types, service names, role
names, and authentication context types. Do not export Prisma models,
database clients, passwords, secrets, or service-internal business logic.

## Adding or changing a Prisma schema

Schema ownership belongs to the service that owns the data. For identity data,
edit:

```text
services/identity/prisma/schema.prisma
```

For another service, create that service's own Prisma directory and schema.
Avoid cross-service foreign keys; services should communicate through API or
event contracts.

After changing a schema:

```bash
cd services/identity
export DATABASE_URL='postgresql://childcare:childcare@localhost:5432/childcare'
pnpm db:generate
pnpm db:migrate --name describe-the-change
```

Use a descriptive migration name, for example:

```bash
pnpm db:migrate --name add_child_profile_fields
```

Review the generated SQL before committing it. Commit both the schema change
and the generated directory:

```text
services/identity/prisma/migrations/<timestamp>_add_child_profile_fields/
```

Do not edit an already-applied migration. Create a new migration that changes
the schema forward.

## Adding seed data

Seed data belongs in the owning service's Prisma seed script:

```text
services/identity/prisma/seed.ts
```

Add deterministic development data with `upsert`, not unconditional `create`,
so the command can be run repeatedly:

```ts
await prisma.tenant.upsert({
  where: { id: 'stable-development-id' },
  update: { name: 'Demo Childcare Center' },
  create: { id: 'stable-development-id', name: 'Demo Childcare Center' }
})
```

Seed rules:

1. Never seed real credentials or production data.
2. Read sensitive seed passwords from environment variables.
3. Hash passwords using the same password helper as authentication.
4. Use stable IDs for repeatable development data.
5. Make relationships explicit, including tenant memberships and roles.
6. Keep seeders safe to run more than once.

Run a seeder with:

```bash
cd services/identity
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

If a new role or permission is added, update the role definitions, schema
models if applicable, authorization checks, and seed data together.

## Adding a new microservice

For a new bounded domain:

1. Create `services/<service-name>`.
2. Give it its own `package.json`, `src`, and `test` directories.
3. Add a Fastify application using the existing service structure.
4. Assign it a unique local development port.
5. Add it to `apps/gateway/src/config/services.ts`.
6. Add its URL to the gateway and setup documentation.
7. Give it its own database schema or database boundary.
8. Add health checks and route tests.
9. Keep service-to-service communication behind explicit HTTP or event
   contracts.

Do not add domain tables for a new service to the identity service merely for
convenience.

## Prerequisites

Install the following tools:

- Node.js 24
- pnpm 11
- Docker Desktop

Verify the installed versions:

```bash
node --version
pnpm --version
docker --version
docker compose version
```

Install workspace dependencies from the repository root:

```bash
pnpm install
```

If pnpm reports a package release-age policy error for the current development
dependencies, use the repository's existing lockfile with:

```bash
pnpm --config.minimum-release-age=0 install
```

## Start Docker infrastructure

Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

Check that both containers are running:

```bash
docker compose ps
```

Stop the containers when finished:

```bash
docker compose down
```

The PostgreSQL data is stored in the `postgres_data` Docker volume and remains
available after containers are stopped.

## Database details

The local PostgreSQL configuration is defined in
[docker-compose.yml](./docker-compose.yml):

```text
Host:     localhost
Port:     5432
Database: childcare
Username: childcare
Password: childcare
```

Connection string:

```text
postgresql://childcare:childcare@localhost:5432/childcare
```

Redis runs at:

```text
Host: localhost
Port: 6379
```

Redis does not have a password configured for local development.

These credentials are development-only defaults. Use secret management and
different credentials in staging and production.

## Prisma migrations and seed data

The identity service owns the initial Prisma schema for users, tenants, and
memberships:

```text
services/identity/prisma/schema.prisma
```

Set the database connection before running Prisma commands:

```bash
export DATABASE_URL='postgresql://childcare:childcare@localhost:5432/childcare'
```

Generate the Prisma client:

```bash
cd services/identity
pnpm db:generate
```

Create and apply the initial development migration:

```bash
pnpm db:migrate --name identity
```

This creates the migration directory:

```text
services/identity/prisma/migrations/
```

Seed a demo tenant and owner account:

```bash
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

The default seeded account is:

```text
Email:  admin@example.com
Role:   OWNER
Tenant: Demo Childcare Center
```

Override the email if needed:

```bash
SEED_ADMIN_EMAIL='admin@childcare.local' \
SEED_ADMIN_PASSWORD='use-at-least-12-characters' \
pnpm db:seed
```

The seed password is required and must contain at least 12 characters.

## Run the complete application

From the repository root, run:

```bash
pnpm dev
```

The root command starts PostgreSQL and Redis, then launches the frontend,
gateway, and backend services through Turborepo.

The command provides these development environment variables:

```text
DATABASE_URL=postgresql://childcare:childcare@localhost:5432/childcare
AUTH_SECRET=local-development-secret-change-me-32-characters
NEXT_PUBLIC_API_URL=http://localhost:4000
```

The default local development URLs are:

| Component | URL |
| --- | --- |
| Frontend | http://localhost:3000 |
| Gateway | http://localhost:4000 |
| Identity | http://localhost:4001 |
| Children | http://localhost:4002 |
| Enrollment | http://localhost:4003 |
| Attendance | http://localhost:4004 |
| Billing | http://localhost:4005 |
| Notifications | http://localhost:4006 |

Open the frontend in a browser:

```text
http://localhost:3000
```

Check the gateway service registry:

```text
http://localhost:4000/health
```

Press `Ctrl+C` to stop the development processes. Stop Docker infrastructure
separately with:

```bash
docker compose down
```

## Run individual services

Each backend service can also be run independently:

```bash
cd services/identity
export DATABASE_URL='postgresql://childcare:childcare@localhost:5432/childcare'
export AUTH_SECRET='replace-with-a-random-secret-of-at-least-32-characters'
pnpm dev
```

The gateway can be run independently with:

```bash
cd apps/gateway
pnpm dev
```

## Troubleshooting

### Port already in use

Check which process is using a port:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:4000 -sTCP:LISTEN
lsof -nP -iTCP:5432 -sTCP:LISTEN
lsof -nP -iTCP:6379 -sTCP:LISTEN
```

Stop an unwanted process using its specific PID, or stop Docker containers:

```bash
docker compose down
```

### Identity service cannot connect to PostgreSQL

Confirm PostgreSQL is running:

```bash
docker compose ps postgres
```

Then confirm `DATABASE_URL` is set correctly:

```bash
echo "$DATABASE_URL"
```

### Database tables do not exist

Apply the Prisma migration:

```bash
cd services/identity
DATABASE_URL='postgresql://childcare:childcare@localhost:5432/childcare' \
pnpm db:migrate --name identity
```

### Authentication secret error

`AUTH_SECRET` must contain at least 32 characters:

```bash
export AUTH_SECRET='replace-with-a-random-secret-of-at-least-32-characters'
```
