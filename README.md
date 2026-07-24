# Queerlective CoLab Dashboard

SvelteKit member portal and admin dashboard for Queerlective's CoLab community studio. The application targets Cloudflare Workers and will use D1, Cloudflare Email Service, and Monday.com's GraphQL API.

## Requirements

- Node.js 22 or newer
- npm
- A Cloudflare account for deployed bindings

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

The Phase 0 landing page is available at `/`. Binding status is available at `/api/health`; the endpoint reports only whether each binding is configured and never exposes values.

## Validation

```sh
npm run check
npm run lint
npm test
npm run build
npm run deploy:dry-run
```

## Cloudflare setup

`wrangler.jsonc` contains the Worker runtime, assets, environment variables, compatibility settings, observability configuration, and production bindings.

Required production bindings:

- `DB`: D1 database
- `MONDAY_API_TOKEN`: Secrets Store binding (the application will also support a classic string secret)
- `EMAIL`: Email Service binding
- `LOGIN_FROM_EMAIL`: non-secret environment variable
- `LOGIN_FROM_NAME`: non-secret environment variable

After changing the binding configuration, regenerate types:

```sh
npm run cf-types
```

Do not commit `.dev.vars`, `.env`, API tokens, or other credentials.

## Deployment

```sh
npm run deploy
```

Deployment requires authenticated Wrangler access and provisioned Cloudflare resources.

## Project documents

- [Project brief](./Here%E2%80%99s%20a%20practical%20project%20brief%20you%20can.md)
- [Phased implementation plan](./PHASED_IMPLEMENTATION_PLAN.md)
