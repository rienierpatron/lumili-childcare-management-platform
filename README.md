# Annavia

Annavia is a multi-tenant childcare management platform with role-based access
control and independently deployable backend services.

This repository is a pnpm/Turborepo monorepo with an explicit frontend/backend
boundary and independently deployable backend services.

See [SETUP.md](./SETUP.md) for Docker, database, Prisma migration and seed,
environment, and application startup instructions.

The setup guide includes separate workflows for first-time installation,
existing databases, daily development, schema updates, seed updates, and
staging/production deployments.

## Repository boundaries

```text
apps/
  web/       Next.js frontend. Talks to the backend over HTTP only.
  gateway/   Public Fastify API gateway and service registry.
services/
  identity/       Authentication, tenants, memberships, and RBAC
  children/       Child and guardian records
  enrollment/     Enrollment and placement
  attendance/     Attendance and check-in
  billing/        Invoices and payments
  notifications/  Email and operational notifications
packages/
  shared/     Transport-safe types and service contracts
  config/     Shared configuration primitives
```

Each backend service owns its routes, plugins, modules, persistence, and tests.
Services must not import another service's implementation files. Cross-service
communication goes through the gateway or an explicit HTTP/event contract.
The frontend must not import from `services/**` or `apps/gateway/**`; use
`apps/web/src/lib/api.ts` and the gateway API instead.

## Running the backend

Start the complete local stack with one command from the repository root:

```bash
pnpm dev
```

This starts PostgreSQL and Redis, then launches the frontend, gateway, and
every backend service through Turborepo. Stop the stack with `Ctrl+C`; stop the
Docker infrastructure separately with `docker compose down`.

The Docker database uses host port `55432` because port `5432` may be used by a
separate local PostgreSQL installation. The Redis container uses host port
`56379`.

For first-time database setup, run:

```bash
cd services/identity
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
pnpm db:generate
pnpm db:migrate --name identity
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

After that, normal development only requires:

```bash
pnpm dev
```

Run a service independently from its directory when needed:

```bash
cd services/identity
AUTH_SECRET='use-a-random-secret-of-at-least-32-characters' npm run dev
```

The gateway exposes the public boundary and reports configured service endpoints
at `GET /health`. Service URLs can be overridden with
`IDENTITY_SERVICE_URL`, `CHILDREN_SERVICE_URL`, `ENROLLMENT_SERVICE_URL`,
`ATTENDANCE_SERVICE_URL`, `BILLING_SERVICE_URL`, and
`NOTIFICATIONS_SERVICE_URL`.

The local development ports are:

```text
web:          http://localhost:30000
gateway:      http://localhost:30001
identity:     http://localhost:30002
children:     http://localhost:30003
enrollment:   http://localhost:30004
attendance:   http://localhost:30005
billing:      http://localhost:30006
notifications:http://localhost:30007
```

## Module rules

Within each Fastify service:

- `src/routes/` contains transport handlers only.
- `src/plugins/` contains reusable Fastify adapters and cross-cutting concerns.
- `src/modules/<module>/` is the home for domain logic and repositories as each
  service grows.
- Tenant identity and authorization must be derived from the authenticated
  request context; never accept a tenant identifier without checking membership.
