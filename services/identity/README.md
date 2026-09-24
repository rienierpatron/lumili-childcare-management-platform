# Identity service

This service owns users, tenants, memberships, and authentication.

## Prisma setup

The PostgreSQL schema is defined in `prisma/schema.prisma`.

```bash
export DATABASE_URL='postgresql://childcare:childcare@localhost:55432/childcare'
pnpm db:generate
pnpm db:migrate --name identity
SEED_ADMIN_PASSWORD='use-at-least-12-characters' pnpm db:seed
```

The seed creates a demo tenant and owner account. Set `SEED_ADMIN_EMAIL` to
override the default `admin@example.com`.

The seeded owner is also a platform owner. Platform users are separate from
childcare organization memberships and use these roles:

- `owner`: manage platform access
- `support`: assist organizations and users
- `sales`: manage sales and onboarding workflows
- `developer`: access approved engineering tools
- `ops`: manage operations and platform access

Platform users are invitation-only. A platform owner or ops user creates an
invitation:

```bash
curl -X POST http://localhost:30002/auth/platform/invitations \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $PLATFORM_OWNER_TOKEN" \
  -d '{"email":"support@example.com","role":"support"}'
```

The response contains a one-time invitation token. The invited user accepts it
with a password:

```bash
curl -X POST http://localhost:30002/auth/platform/invitations/accept \
  -H 'content-type: application/json' \
  -d '{"token":"INVITATION_TOKEN","password":"use-at-least-12-characters"}'
```

They can then sign in with the platform scope:

```bash
curl -X POST http://localhost:30002/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"support@example.com","password":"use-at-least-12-characters","scope":"platform"}'
```

Platform sessions contain `platformRole` instead of a childcare organization
`tenantId`.

Tests use `AUTH_DATABASE_MODE=memory` so they do not require a running
PostgreSQL instance. Production and development runs use Prisma by default.
The seed command uses `tsx` because it is compatible with the Node 24
development environment.

## Available Scripts

In the project directory, you can run:

### `npm run dev`

To start the app in dev mode.\
Open [http://localhost:30000](http://localhost:30000) to view it in the browser.

### `npm start`

For production mode

### `npm run test`

Run the test cases.

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
