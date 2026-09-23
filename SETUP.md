# Lumili Local Development Setup

This guide explains how to run Lumili, the childcare management platform,
locally.

## Choose the workflow you need

Use the section that matches your situation:

| Situation | Follow |
| --- | --- |
| New machine or deleted database volume | [First-time setup](#first-time-setup) |
| Database and migrations already exist | [Start an existing local setup](#start-an-existing-local-setup) |
| Normal daily development | [Daily development](#daily-development) |
| Prisma schema changed | [Update the database after a schema change](#update-the-database-after-a-schema-change) |
| New or changed development data | [Update seed data](#update-seed-data) |
| Staging or production deployment | [Staging and production](#staging-and-production) |

## First-time setup

Follow these steps when setting up Lumili on a new machine, or after deleting
the PostgreSQL Docker volume.

### 1. Install prerequisites

Install:

- Node.js 24
- pnpm 11
- Docker Desktop

Verify them:

```bash
node --version
pnpm --version
docker --version
docker compose version
```

### 2. Install dependencies

From the repository root:

```bash
pnpm install
```

If pnpm reports a release-age policy error:

```bash
pnpm --config.minimum-release-age=0 install
```

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d postgres redis
docker compose ps
```

Wait until both containers show `Up`.

Lumili uses these host ports to avoid conflicts with common local
installations:

```text
PostgreSQL: localhost:55432
Redis:      localhost:56379
```

### 4. Configure the identity database

Change to the identity service:

```bash
cd services/identity
```

Set the Docker PostgreSQL connection:

```bash
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
```

Generate the Prisma client:

```bash
pnpm db:generate
```

Create and apply the first migration:

```bash
pnpm db:migrate --name identity
```

This creates the committed migration directory under
`services/identity/prisma/migrations/` and creates the application tables.

Seed the initial development tenant and owner:

```bash
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

The seed creates:

```text
Tenant: Demo Childcare Center
Email:  admin@example.com
Role:   OWNER
```

### 5. Start Lumili

Return to the repository root:

```bash
cd ../..
pnpm dev
```

Open the frontend at:

```text
http://localhost:30000
```

## Start an existing local setup

Use this workflow when PostgreSQL already contains the Lumili database and the
initial migration and seed have already been applied.

### 1. Start infrastructure

From the repository root:

```bash
docker compose up -d postgres redis
docker compose ps
```

### 2. Check migration status

```bash
cd services/identity
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
pnpm db:migrate:status
```

If Prisma reports that all migrations are applied, do not run
`db:migrate --name identity` again.

If the database has no migration history, use the first-time setup workflow
instead.

### 3. Start the application

```bash
cd ../..
pnpm dev
```

Do not run migrations or seeders every time you start the application. They are
only needed when the database or schema requires them.

## Daily development

Once the initial setup is complete, the normal daily workflow is:

```bash
cd /path/to/childcare-management
pnpm dev
```

Open:

```text
http://localhost:30000
```

To stop the application, press `Ctrl+C`. To stop Docker infrastructure:

```bash
docker compose down
```

`docker compose down` preserves the PostgreSQL volume. The database, tables,
users, tenants, and seed history remain available the next time you run
`docker compose up -d`.

Do not use `docker compose down -v` unless you intentionally want to delete the
local database and start over.

## Update the database after a schema change

Use this workflow when you edit a Prisma schema, for example
`services/identity/prisma/schema.prisma`.

### 1. Make the schema change

Edit the schema in the service that owns the data. Do not add another service's
tables to the identity schema.

### 2. Generate the Prisma client

```bash
cd services/identity
pnpm db:generate
```

### 3. Create and apply a named migration

```bash
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
pnpm db:migrate --name describe_the_change
```

Example:

```bash
pnpm db:migrate --name add_membership_status
```

Prisma records the applied migration in `_prisma_migrations`. Review the
generated SQL and commit both the schema and migration directory.

### 4. Test the application

```bash
pnpm --filter identity test
```

For another service, replace `identity` with that service's workspace name.

### 5. Restart development

Stop the running development process with `Ctrl+C`, then:

```bash
cd ../..
pnpm dev
```

Never edit an already-applied migration. Create a new migration for every
subsequent schema change.

## Update seed data

Seed data is versioned separately from Prisma migrations.

### Existing seed version

Running this command on an already-seeded database is safe:

```bash
cd services/identity
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

If the same seed version already ran, the command reports its execution time
and skips it.

### New seed version

When adding new development or controlled environment data:

1. Edit `services/identity/prisma/seed.ts`.
2. Increment the `seedVersion` value, for example from `001` to `002`.
3. Use `upsert` or another repeatable operation.
4. Keep password values in environment variables.
5. Run the seeder against a disposable development database first.
6. Commit the seed change.

Then run:

```bash
cd services/identity
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

The `SeedExecution` table records the seed name, version, and execution time.
Never delete execution records to force a seed to run again in staging or
production; create a new seed version instead.

## Staging and production

Staging and production must use a managed PostgreSQL connection and secret
environment variables. Do not use the local Docker credentials or the local
`AUTH_SECRET`.

### 1. Deploy the application code

Deploy the commit containing the schema and migration files.

### 2. Check migration status

From the identity service:

```bash
export DATABASE_URL='postgresql://<user>:<password>@<host>:<port>/<database>'
pnpm db:migrate:status
```

### 3. Apply committed migrations

```bash
pnpm db:deploy
```

Use `db:deploy`, not `db:migrate`, in staging or production. The deploy
command only applies migrations already committed to the repository.

### 4. Generate the client during the build

```bash
pnpm db:generate
```

### 5. Run an approved seed version

Only run seeders that are designed for the target environment:

```bash
SEED_ADMIN_EMAIL='admin@example.com' \
SEED_ADMIN_PASSWORD='<secret-from-secret-management>' \
pnpm db:seed
```

Review the `SeedExecution` record after completion. Never use real production
passwords in source code or documentation.

### 6. Verify

Check migration status again:

```bash
pnpm db:migrate:status
```

Then verify the service health endpoint and application login flow.

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
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
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

The identity seeder records its execution in the `SeedExecution` table using a
stable seed name and version. Re-running the same seed version prints its
original execution time and skips the data changes. When a new seed change is
needed, increment `seedVersion`, add the new logic, and deploy it as a new
version. Seed execution and data changes are committed in one database
transaction.

To inspect recorded seed executions:

```sql
SELECT "seedName", "version", "executedAt"
FROM "SeedExecution"
ORDER BY "executedAt";
```

Run seeders explicitly in staging or production only after migrations have
been applied and the required secrets are supplied:

```bash
SEED_ADMIN_EMAIL='admin@example.com' \
SEED_ADMIN_PASSWORD='use-a-secret-password' \
pnpm db:seed
```

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
Port:     55432
Database: childcare
Username: childcare
Password: childcare
```

Connection string:

```text
postgresql://childcare:childcare@localhost:55432/childcare
```

Redis runs at:

```text
Host: localhost
Port: 56379
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
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
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

The complete first-time identity database setup is:

```bash
cd services/identity
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
pnpm db:generate
pnpm db:migrate --name identity
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

Use port `55432` in this command. Port `5432` may point to a separate
PostgreSQL installation on the host rather than the Lumili Docker container.

Prisma records every applied migration in its internal `_prisma_migrations`
table. For staging and production, apply committed migrations without creating
new ones:

```bash
pnpm db:migrate:status
pnpm db:deploy
```

Never use `prisma migrate dev` against staging or production. Review migration
status before deployment and treat a failed migration as a release failure.

This creates the migration directory:

```text
services/identity/prisma/migrations/
```

Seed a demo tenant and owner account:

```bash
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

The seed command uses `tsx` and records its version in `SeedExecution`. If the
same version has already run, it reports the original execution time and
skips the data changes.

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
DATABASE_URL=postgresql://childcare:childcare@localhost:55432/childcare
AUTH_SECRET=local-development-secret-change-me-32-characters
NEXT_PUBLIC_API_URL=http://localhost:30001
```

The default local development URLs are:

| Component | URL |
| --- | --- |
| Frontend | http://localhost:30000 |
| Gateway | http://localhost:30001 |
| Identity | http://localhost:30002 |
| Children | http://localhost:30003 |
| Enrollment | http://localhost:30004 |
| Attendance | http://localhost:30005 |
| Billing | http://localhost:30006 |
| Notifications | http://localhost:30007 |

Open the frontend in a browser:

```text
http://localhost:30000
```

Check the gateway service registry:

```text
http://localhost:30001/health
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
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
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
lsof -nP -iTCP:30000 -sTCP:LISTEN
lsof -nP -iTCP:30001 -sTCP:LISTEN
lsof -nP -iTCP:55432 -sTCP:LISTEN
lsof -nP -iTCP:56379 -sTCP:LISTEN
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
DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare' \
pnpm db:migrate --name identity
```

### Authentication secret error

`AUTH_SECRET` must contain at least 32 characters:

```bash
export AUTH_SECRET='replace-with-a-random-secret-of-at-least-32-characters'
```
