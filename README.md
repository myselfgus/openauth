# OpenAuth Server

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/openauth-template)

![OpenAuth Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/b2ff10c6-8f7c-419f-8757-e2ccf1c84500/public)

<!-- dash-content-start -->

[OpenAuth](https://openauth.js.org/) is a universal provider for managing user authentication. By deploying OpenAuth on Cloudflare Workers, you can add scalable authentication to your application. This demo showcases login, user registration, and password reset, with storage and state powered by [D1](https://developers.cloudflare.com/d1/), [KV](https://developers.cloudflare.com/kv/), and [R2](https://developers.cloudflare.com/r2/). [Observability](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#enable-workers-logs) is on by default.

## 🗄️ Storage Features

This template includes optimized storage helpers for:
- **KV**: Fast cache, sessions, and rate limiting
- **D1**: Relational database with optimized indexes
- **R2**: Object storage for files and backups

📖 **[Read the complete Storage Guide](./STORAGE.md)**

> [!IMPORTANT]
> When using C3 to create this project, select "no" when it asks if you want to deploy. You need to follow this project's [setup steps](https://github.com/cloudflare/templates/tree/main/openauth-template#setup-steps) before deploying.

<!-- dash-content-end -->

## Getting Started

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/openauth-template
```

A live public deployment of this template is available at [https://openauth-template.templates.workers.dev](https://openauth-template.templates.workers.dev)

## Setup Steps

### Quick Setup (Recommended)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Authenticate with Cloudflare:
   ```bash
   npx wrangler login
   ```

3. Run automated setup (creates KV, D1, R2, and applies migrations):
   ```bash
   npm run setup
   ```

4. Deploy the project:
   ```bash
   npm run deploy
   ```

5. Monitor your worker:
   ```bash
   npx wrangler tail
   ```

### Manual Setup (Alternative)

If you prefer to set up resources manually:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a [D1 database](https://developers.cloudflare.com/d1/get-started/):
   ```bash
   npx wrangler d1 create openauth--auth-db
   ```
   Update the `database_id` in `wrangler.json` with the new database ID.

3. Apply database migrations:
   ```bash
   npm run migrate
   ```

4. Create a [KV namespace](https://developers.cloudflare.com/kv/get-started/):
   ```bash
   npx wrangler kv namespace create AUTH_STORAGE
   ```
   Update the `kv_namespaces` -> `id` in `wrangler.json` with the new namespace ID.

5. Create an [R2 bucket](https://developers.cloudflare.com/r2/get-started/):
   ```bash
   npx wrangler r2 bucket create openauth-storage
   ```

6. Deploy:
   ```bash
   npm run deploy
   ```

## Available Scripts

- `npm run dev` - Start local development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm run setup` - Automated setup of all resources
- `npm run migrate` - Apply database migrations
- `npm run optimize` - Optimize database performance
- `npm run backup` - Backup database to R2
- `npm run check` - Type check and dry-run deploy
