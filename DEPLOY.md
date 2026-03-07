# Deploy Checklist

## Overview

Two-service architecture:
- **Web App** (`apps/web`) -- Next.js 15 on Vercel (Server Actions, SSR)
- **Agent Service** (`apps/agent`) -- Mastra AI on Railway (Docker, Hono HTTP server)

Both services communicate via shared API key over HTTPS.

## Prerequisites

1. **Google Cloud project** with these APIs enabled:
   - Google Slides API
   - Google Drive API
   - Google Docs API
   - Vertex AI API
2. **Google Cloud OAuth 2.0 Client** (Web application type) -- for user-delegated credentials
3. **Google Cloud Service Account** with key JSON -- for fallback API access
4. **Supabase project** with PostgreSQL database and Auth enabled
5. **Vercel account** for web deployment
6. **Railway account** for agent deployment

## Environment Variables

### Agent Service (`apps/agent`)

| Variable | Description | Source | Required |
|----------|-------------|--------|----------|
| `DATABASE_URL` | Supabase pooled connection (port 6543, pgbouncer) | Supabase Dashboard > Settings > Database > Connection string (pooled) | Yes |
| `DIRECT_URL` | Supabase direct connection (port 5432, for migrations) | Supabase Dashboard > Settings > Database > Connection string (direct) | Yes |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON string of Google service account credentials | Google Cloud Console > IAM > Service Accounts > Keys > Create key (JSON) | Yes |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder ID for generated presentations | Google Drive > Shared Drive or folder URL (ID after `/folders/`) | Yes |
| `GOOGLE_TEMPLATE_PRESENTATION_ID` | Lumenalta branded template presentation ID | Google Slides URL (ID between `/d/` and `/edit`) | Yes |
| `MEET_LUMENALTA_PRESENTATION_ID` | Source presentation for Touch 2 intro decks | Google Slides URL | No (defaults to empty) |
| `CAPABILITY_DECK_PRESENTATION_ID` | Source presentation for Touch 3 capability decks | Google Slides URL | No (falls back to `MEET_LUMENALTA_PRESENTATION_ID`) |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud project ID for Vertex AI | Google Cloud Console > Project selector | Yes |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI region (e.g., `us-central1`) | Google Cloud Console | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON file (set by entrypoint) | Auto-configured via Docker entrypoint credential injection | Yes |
| `MASTRA_PORT` | HTTP server port | Default: `4111` | No |
| `AGENT_API_KEY` | Shared API key for web-agent auth | Generate: `openssl rand -base64 32` | Yes |
| `WEB_APP_URL` | Web app origin for CORS | Vercel deployment URL (e.g., `https://your-app.vercel.app`) | No (defaults to `http://localhost:3000`) |
| `NODE_ENV` | Environment mode | `production` for deployed environments | No (defaults to `development`) |

#### v1.3 Additions (User-Delegated Credentials)

| Variable | Description | Source | Required |
|----------|-------------|--------|----------|
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for encrypting stored refresh tokens (64 hex chars = 32 bytes) | Generate: `openssl rand -hex 32` | No (optional; validated at encryption call time) |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID for refresh token exchange | Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs | Yes |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret for refresh token exchange | Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs | Yes |

### Web App (`apps/web`)

| Variable | Description | Source | Required |
|----------|-------------|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard > Settings > API > Project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Supabase Dashboard > Settings > API > anon/public key | Yes |
| `AGENT_SERVICE_URL` | Agent service base URL | Railway deployment URL (e.g., `https://your-agent.up.railway.app`) | No (defaults to `http://localhost:4111`) |
| `AGENT_API_KEY` | Shared API key (must match agent service) | Same value as agent `AGENT_API_KEY` | Yes |
| `NODE_ENV` | Environment mode | `production` for deployed environments | No |

## Supabase Configuration

### Google OAuth Provider

1. Go to **Supabase Dashboard > Authentication > Providers > Google**
2. Enable Google provider
3. Set **Client ID** and **Client Secret** from your Google Cloud OAuth 2.0 Client
4. Set the **Authorized redirect URI** in Google Cloud Console to:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

### OAuth Scopes (v1.3)

The login flow requests these scopes for user-delegated Google API access:

```
openid
email
profile
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/presentations.readonly
https://www.googleapis.com/auth/documents.readonly
```

These are configured in the web app login page code (`apps/web/src/app/login/page.tsx`), not in Supabase Dashboard.

**Offline access:** The login flow requests `access_type: offline` to obtain a refresh token. The consent screen is forced on every login (`prompt: consent`) to ensure Google returns the refresh token.

## Database Setup

**IMPORTANT:** Never use `prisma db push`. All schema changes go through migrations.

```bash
# First deployment: apply all migrations
cd apps/agent
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

For subsequent deployments, `prisma migrate deploy` applies only new migrations.

## Deployment

### Agent Service (Railway)

1. Connect Railway to your GitHub repo
2. Set root directory to `apps/agent` (or use Docker build from repo root)
3. Configure all agent environment variables above
4. Railway auto-deploys on push to main
5. The Docker entrypoint injects `GOOGLE_SERVICE_ACCOUNT_KEY` as a temp credentials file

### Web App (Vercel)

1. Connect Vercel to your GitHub repo
2. Set framework preset to Next.js
3. Set root directory to `apps/web`
4. Configure all web environment variables above
5. Vercel auto-deploys on push to main

### CI/CD (CircleCI)

The pipeline runs: lint > build > migrate > deploy-agent > deploy-web on push to main.

#### Slack success notifications via Resend email

CircleCI now sends one success email after the full deployment workflow finishes. Slack posts that email into the private `atlus-deck` channel through the channel email address you already have, so no Slack admin access or Slack bot install is required.

Add these CircleCI environment variables in Project Settings or a Context:

| Variable | Description | Source |
|----------|-------------|--------|
| `RESEND_API_KEY` | API key used to send the notification email | Resend dashboard > API Keys |
| `RESEND_FROM_EMAIL` | Verified sender address used by Resend, for example `deploys@updates.yourdomain.com` | Resend dashboard > Domains / Verified senders |
| `SLACK_CHANNEL_EMAIL` | Slack channel email target; defaults in config to the current `atlus-deck` email if omitted | Slack channel email address |

Recommended Resend setup:

1. Create a Resend account.
2. Verify a sending domain in Resend, or verify a sender identity if your plan supports it.
3. Create an API key with permission to send email.
4. Copy the key into CircleCI as `RESEND_API_KEY`.
5. Copy your verified sender address into CircleCI as `RESEND_FROM_EMAIL`.
6. Optional: set `SLACK_CHANNEL_EMAIL` explicitly to `atlus-deck-aaaatjj2cixlodxayed2erpcme@lumenalta.slack.com` so the target is visible in CircleCI settings instead of relying on the config default.

Slack checks:

1. Confirm emails sent to `atlus-deck-aaaatjj2cixlodxayed2erpcme@lumenalta.slack.com` still appear in the `atlus-deck` private channel.
2. If Slack restricts allowed senders for that channel email integration, allow the same `RESEND_FROM_EMAIL` address or sending domain you configured in Resend.

Verification flow:

1. Add the CircleCI variables above.
2. Push a small commit to `main`.
3. Wait for the CircleCI workflow to complete successfully.
4. Confirm exactly one message lands in the `atlus-deck` private channel after `deploy-web` finishes.
5. If no message appears, check the `notify-success` CircleCI job logs for the Resend API response first, then verify Slack still accepts mail from the configured sender.

---

*Last updated: 2026-03-07 for quick task 12*
