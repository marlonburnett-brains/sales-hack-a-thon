# Phase 17: Deployment & Go-Live - Research

**Researched:** 2026-03-05
**Domain:** Cloud deployment (Vercel + Oracle Cloud VM + Docker + Caddy)
**Confidence:** HIGH

## Summary

This phase deploys the platform to production: the Next.js web app on Vercel and the Mastra agent server on an Oracle Cloud Ampere A1 VM with Docker and Caddy for HTTPS. The monorepo structure (pnpm workspaces + Turborepo) requires specific Vercel configuration -- setting the root directory to `apps/web` and using Turborepo-aware build commands. The agent server deployment uses `mastra build` to produce a self-contained `.mastra/output/` directory that runs with `node index.mjs`, containerized with Docker and fronted by Caddy for automatic Let's Encrypt TLS.

The critical technical challenge is Vertex AI authentication: `GOOGLE_APPLICATION_CREDENTIALS` only supports file paths (not inline JSON), so the Docker entrypoint must write the credentials JSON from an environment variable to a file before starting the server. Google Workspace auth (`GOOGLE_SERVICE_ACCOUNT_KEY`) already uses inline JSON parsing and needs no changes. The same service account can serve both purposes if it has the right IAM roles.

**Primary recommendation:** Use Docker Compose with a Caddy sidecar for the agent server on Oracle VM. Write Vertex AI credentials to a file via entrypoint script. Deploy web via Vercel with root directory `apps/web` and per-environment variables.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- VM does not exist yet -- plan includes full provisioning steps (Oracle Cloud console walkthrough)
- Plan covers: instance creation, networking (ports 80/443 open), SSH key setup, then Docker + Caddy + app installation
- Plan includes a manual steps checklist for Google Cloud Console (OAuth redirect URIs) and Supabase dashboard (prod URL configuration)
- GitHub repo exists -- can use for deploy automation
- Brief restart is acceptable (docker compose down + up) -- no zero-downtime requirement for internal tool
- A domain is available for the agent server -- can point a subdomain at the Oracle VM IP for Caddy auto-TLS via Let's Encrypt
- Vertex AI auth approach needs investigation (whether same service account as Google Workspace)

### Claude's Discretion
- OS choice for Oracle VM (Ubuntu vs Oracle Linux on ARM64)
- VM specs (free tier vs larger allocation)
- Deploy method: SSH deploy script vs GitHub Actions CI/CD vs Docker registry
- Build location: on VM (git pull + docker build) vs CI (build + transfer image)
- Web URL: Vercel default vs custom domain
- Agent URL: subdomain via Caddy vs free DNS service
- Vertex AI credentials: mount key file in Docker vs convert to inline JSON env var
- Secrets storage on VM: .env file vs Docker secrets
- googleapis bundle size: check if it's imported in web app and address if needed
- Dockerfile, Caddyfile, docker-compose.yml, and deploy script contents
- Vercel project configuration (root directory, build command, framework preset)
- Environment variable naming and organization

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | Next.js web app deploys to Vercel with production and preview environments | Vercel monorepo configuration with root directory `apps/web`, framework auto-detection for Next.js |
| DEPLOY-02 | Production deploys from main branch; preview deploys from other branches | Vercel default behavior -- production from main, preview from all other branches |
| DEPLOY-03 | Environment variables configured per Vercel environment (prod Supabase for production, dev Supabase for preview) | Vercel dashboard env vars with environment scoping (Production / Preview / Development) |
| DEPLOY-04 | Mastra agent server runs on Oracle Cloud Ampere A1 VM with HTTPS via reverse proxy | Docker + Caddy on ARM64 Ubuntu VM; Caddy auto-TLS with subdomain |
| DEPLOY-05 | Agent server auto-restarts on crash (Docker restart policy) | `restart: unless-stopped` in docker-compose.yml |
| DEPLOY-06 | CI/CD: web auto-deploys via Vercel on push; agent deploys via GitHub Actions or deploy script | Vercel Git integration (automatic); SSH deploy script for agent (simpler for internal tool) |
| DEPLOY-07 | Google Workspace API credentials work in deployed environments (inline JSON, no file path dependency) | Workspace auth already uses inline JSON via `GOOGLE_SERVICE_ACCOUNT_KEY`; Vertex AI auth resolved via entrypoint script writing file from env var |
</phase_requirements>

## Standard Stack

### Core
| Component | Version/Image | Purpose | Why Standard |
|-----------|---------------|---------|--------------|
| Docker | latest | Container runtime | Industry standard for deployment, ARM64 support |
| Docker Compose | v2 (plugin) | Multi-container orchestration | Simple declarative config for app + Caddy |
| Caddy | 2-alpine | Reverse proxy + auto-TLS | Zero-config HTTPS via Let's Encrypt, simpler than Nginx |
| Node.js | 22-alpine | Runtime for Mastra server | Required by Mastra (Node.js v22.13.0+) |
| Ubuntu | 24.04 (Canonical) | VM operating system | Official ARM64 support on Oracle Cloud, better Docker ecosystem than Oracle Linux |
| Vercel | Platform | Web app hosting | Native Next.js support, automatic CI/CD, preview deployments |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| SSH deploy script | Agent server deployment | On each push to main (manual trigger or GitHub Actions) |
| pnpm | Package manager | Already used in monorepo (v9.12.0) |
| Turborepo | Build orchestration | Used by Vercel for optimized builds |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Caddy | Nginx + Certbot | Caddy is zero-config TLS; Nginx requires manual cert management |
| Ubuntu 24.04 | Oracle Linux 8 | Ubuntu has better community Docker support and `apt` ecosystem; OL uses `dnf` and may have quirks with Docker CE |
| SSH deploy script | GitHub Actions CI/CD | SSH script is simpler for internal tool; GH Actions adds complexity for minimal benefit at this scale |
| Build on VM | Build in CI + transfer image | Building on VM avoids Docker registry costs/complexity; ARM64 cross-compilation in CI is slow |

## Architecture Patterns

### Recommended Deployment Structure
```
# On Oracle Cloud VM
/opt/lumenalta/
  docker-compose.yml      # App + Caddy services
  Caddyfile               # Reverse proxy config
  .env                    # Secrets (DATABASE_URL, API keys, etc.)
  entrypoint.sh           # Writes credentials file + starts server

# In monorepo (committed)
deploy/
  Dockerfile              # Agent server Docker image
  Caddyfile               # Caddy reverse proxy config
  docker-compose.yml      # Docker Compose for agent + Caddy
  entrypoint.sh           # Container entrypoint script
  deploy.sh               # SSH deployment script
```

### Pattern 1: Vercel Monorepo Deployment
**What:** Deploy `apps/web` from a pnpm monorepo with workspace dependencies
**When to use:** Any Vercel deployment from a monorepo

Configuration in Vercel dashboard:
- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** `cd ../.. && pnpm turbo build --filter=web` (or leave default -- Vercel auto-detects Turborepo)
- **Install Command:** auto-detected (pnpm, from lockfile at root)
- **Node.js Version:** 22.x

Key considerations:
- Vercel auto-detects pnpm from the lockfile and runs install from the monorepo root
- The `@lumenalta/schemas` workspace dependency is resolved because Vercel installs from root
- `turbo.json` has `"build": { "dependsOn": ["^build", "^db:generate"] }` -- Vercel handles this via Turborepo integration
- Environment variables set in Vercel dashboard are available during build AND runtime
- `next.config.ts` imports `./src/env` which validates env vars at build time -- all must be set in Vercel

### Pattern 2: Docker + Caddy on ARM64 VM
**What:** Containerized Mastra agent server with Caddy reverse proxy for auto-TLS
**When to use:** Deploying Hono/Node.js servers that need HTTPS

Dockerfile for agent server:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
# Copy monorepo root for workspace resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/agent/ ./apps/agent/
RUN corepack enable && pnpm install --frozen-lockfile
WORKDIR /app/apps/agent
RUN pnpm build
# Prisma generate for the built output
RUN npx prisma generate

FROM node:22-alpine
RUN apk add --no-cache gcompat
WORKDIR /app
# Copy mastra build output
COPY --from=builder /app/apps/agent/.mastra/output/ ./
# Copy Prisma client (needed at runtime)
COPY --from=builder /app/apps/agent/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=builder /app/apps/agent/node_modules/@prisma/ ./node_modules/@prisma/
# Copy entrypoint
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# Non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mastra -u 1001 && \
    chown -R mastra:nodejs /app
USER mastra
ENV NODE_ENV=production
ENV PORT=4111
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "index.mjs"]
```

Caddyfile:
```
agent.yourdomain.com {
    reverse_proxy app:4111
}
```

docker-compose.yml:
```yaml
services:
  app:
    build:
      context: .
      dockerfile: deploy/Dockerfile
    env_file: .env
    restart: unless-stopped
    expose:
      - "4111"

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

### Pattern 3: Vertex AI Credentials in Docker (Entrypoint Script)
**What:** Write inline JSON credentials to a file at container startup for `GOOGLE_APPLICATION_CREDENTIALS`
**When to use:** When deploying to environments where you cannot mount a credentials file

The `@google/genai` SDK reads `GOOGLE_APPLICATION_CREDENTIALS` automatically, but this env var ONLY supports file paths (verified in google-auth-library source). The entrypoint script writes the JSON content from a separate env var to a file:

```bash
#!/bin/sh
# entrypoint.sh
# Write Vertex AI credentials file from env var
if [ -n "$VERTEX_SERVICE_ACCOUNT_KEY" ]; then
  echo "$VERTEX_SERVICE_ACCOUNT_KEY" > /tmp/vertex-credentials.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/vertex-credentials.json
fi
exec "$@"
```

**Alternative (code change):** The `@google/genai` SDK v1.43.0 constructor accepts `googleAuthOptions: { credentials: parsedJSON }` via the `GoogleAuthOptions` interface from `google-auth-library`. This would eliminate the file path dependency entirely by passing inline credentials programmatically. However, this requires modifying every `new GoogleGenAI(...)` call across 8+ files. The entrypoint script approach requires zero code changes.

**Recommendation:** Use the entrypoint script approach (zero code changes, works with existing `GOOGLE_APPLICATION_CREDENTIALS` pattern).

### Pattern 4: SSH Deploy Script
**What:** Simple deployment via SSH for internal tools
**When to use:** Low-complexity deployments without CI/CD infrastructure

```bash
#!/bin/bash
# deploy.sh - Run from local machine or CI
set -euo pipefail
SSH_HOST="your-vm-ip"
SSH_USER="ubuntu"
DEPLOY_DIR="/opt/lumenalta"

ssh $SSH_USER@$SSH_HOST << 'DEPLOY'
  cd /opt/lumenalta
  git pull origin main
  docker compose build --no-cache
  docker compose down
  docker compose up -d
  # Verify health
  sleep 5
  curl -sf http://localhost:4111/health || echo "Health check failed!"
DEPLOY
```

### Anti-Patterns to Avoid
- **Building Docker images in CI and transferring to ARM64 VM:** Cross-compilation is slow and error-prone. Build on the VM instead.
- **Using `docker compose restart` instead of `down + up`:** Restart does not pick up new images or config changes.
- **Storing secrets in docker-compose.yml or Dockerfile:** Use `.env` file with proper permissions (chmod 600).
- **Running Caddy without persistent volumes:** Caddy will re-request certificates on every restart, hitting Let's Encrypt rate limits.
- **Using `prisma db push` in production:** Per project rules, always use `prisma migrate deploy` for production.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS certificates | Manual cert management + cron renewal | Caddy auto-TLS | Caddy handles issuance, renewal, OCSP stapling automatically |
| Process management | systemd units + manual restart | Docker restart policy | `restart: unless-stopped` handles crash recovery |
| Reverse proxy | Custom Node.js proxy | Caddy reverse_proxy | Battle-tested, handles WebSocket, HTTP/2, headers |
| Environment separation | Custom env loading logic | Vercel environment scoping | Built-in Production/Preview/Development separation |
| Health monitoring | Custom monitoring service | curl + Docker health checks | Simple internal tool; health endpoint already exists |

**Key insight:** For an internal tool with a single VM and a single web app, simplicity beats sophistication. Docker Compose + Caddy + SSH deploy script is the right level of complexity.

## Common Pitfalls

### Pitfall 1: GOOGLE_APPLICATION_CREDENTIALS Does Not Accept Inline JSON
**What goes wrong:** Setting `GOOGLE_APPLICATION_CREDENTIALS` to a JSON string instead of a file path causes auth failure.
**Why it happens:** The `google-auth-library` reads this env var and immediately calls `fs.realpathSync()` on it, treating it as a file path.
**How to avoid:** Use an entrypoint script that writes JSON content from a separate env var (`VERTEX_SERVICE_ACCOUNT_KEY`) to a temp file, then sets `GOOGLE_APPLICATION_CREDENTIALS` to that file path.
**Warning signs:** Auth errors like "ENOENT" or "path not found" when starting the container.

### Pitfall 2: Vercel Monorepo Build Fails Due to Missing Workspace Dependencies
**What goes wrong:** Vercel cannot resolve `@lumenalta/schemas` workspace dependency during build.
**Why it happens:** Vercel installs dependencies from the monorepo root but builds from the root directory (`apps/web`). If the workspace dependency is not properly declared, resolution fails.
**How to avoid:** Ensure `pnpm-workspace.yaml` includes `packages/*`, verify `@lumenalta/schemas` is in `apps/web/package.json` as `workspace:*`, and set root directory to `apps/web` (not the monorepo root).
**Warning signs:** Build errors like "Cannot find module '@lumenalta/schemas'" or "ERR_PNPM_WORKSPACE_PKG_NOT_FOUND".

### Pitfall 3: Vercel Build Fails Due to Missing Environment Variables
**What goes wrong:** `next.config.ts` imports `./src/env` which uses `@t3-oss/env-nextjs` validation -- if any required env var is missing at build time, the build crashes.
**Why it happens:** `NEXT_PUBLIC_*` variables and server-side variables validated at build time must be set in Vercel environment settings.
**How to avoid:** Set ALL env vars in Vercel dashboard before first deployment: `AGENT_SERVICE_URL`, `AGENT_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**Warning signs:** Build error with Zod validation message about missing environment variables.

### Pitfall 4: ARM64 Docker Image Compatibility
**What goes wrong:** Docker images pulled on the Ampere A1 VM fail because they are built for x86_64.
**Why it happens:** Many Docker Hub images default to amd64. The Ampere A1 is aarch64 (ARM64).
**How to avoid:** Use `node:22-alpine` and `caddy:2-alpine` which have multi-arch manifests including arm64. Verify with `docker image inspect --format '{{.Architecture}}'`.
**Warning signs:** "exec format error" when starting containers.

### Pitfall 5: Let's Encrypt Rate Limits
**What goes wrong:** Caddy fails to obtain certificates after too many requests.
**Why it happens:** Re-creating Caddy without persistent `/data` volume causes repeated certificate requests. Let's Encrypt has a limit of 5 duplicate certificates per week.
**How to avoid:** Always mount `caddy_data` volume. Use Let's Encrypt staging endpoint during testing: add `acme_ca https://acme-staging-v02.api.letsencrypt.org/directory` to Caddyfile while debugging.
**Warning signs:** Certificate errors or "too many requests" in Caddy logs.

### Pitfall 6: Oracle Cloud Ingress Rules
**What goes wrong:** Caddy is running but not accessible from the internet.
**Why it happens:** Oracle Cloud has TWO layers of firewall: Security List (VCN level) AND iptables/nftables on the VM itself. Both must allow ports 80 and 443.
**How to avoid:** Configure ingress rules in the Oracle Cloud Security List for ports 80 and 443. On Ubuntu, also run `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT` and same for 443 (or configure via `ufw`).
**Warning signs:** Connection timeout to the VM IP on ports 80/443 even though services are running.

### Pitfall 7: Prisma Client Not Available in Docker Build
**What goes wrong:** Runtime errors about missing Prisma client when the container starts.
**Why it happens:** `mastra build` bundles the application code but Prisma client is generated separately and must be available in the Docker image.
**How to avoid:** Run `npx prisma generate` in the builder stage and copy the generated client to the production stage.
**Warning signs:** "PrismaClientInitializationError" or "Cannot find module '.prisma/client'" at runtime.

### Pitfall 8: Supabase OAuth Redirect URI Misconfiguration
**What goes wrong:** Google OAuth login fails in production with redirect_uri mismatch.
**Why it happens:** Google Cloud Console OAuth credentials must include the production Vercel URL as an authorized redirect URI. Supabase project settings must also list the correct site URL.
**How to avoid:** Update Google Cloud Console: add `https://your-vercel-url.vercel.app` to authorized redirect URIs. Update Supabase dashboard: set Site URL to the production URL and add preview URL patterns to Additional Redirect URLs.
**Warning signs:** OAuth error "redirect_uri_mismatch" or "Error 400: redirect_uri_mismatch".

## Code Examples

### Agent Server Environment Variables (.env on VM)
```bash
# Supabase PostgreSQL (PRODUCTION)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"

# Google Workspace (inline JSON -- already working)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"..."}'
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
GOOGLE_TEMPLATE_PRESENTATION_ID=your-template-id
MEET_LUMENALTA_PRESENTATION_ID=
CAPABILITY_DECK_PRESENTATION_ID=

# Vertex AI (written to file by entrypoint.sh)
VERTEX_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"..."}'
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_CLOUD_LOCATION=us-central1

# Server config
NODE_ENV=production
MASTRA_PORT=4111
AGENT_API_KEY=your-production-api-key
```

### Vercel Environment Variables (Dashboard)
**Production environment:**
```
AGENT_SERVICE_URL=https://agent.yourdomain.com
AGENT_API_KEY=your-production-api-key
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
```

**Preview environment:**
```
AGENT_SERVICE_URL=https://agent.yourdomain.com  (or dev agent URL)
AGENT_API_KEY=dev-api-key
NEXT_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
```

### Prisma Migration for Production
```bash
# On VM, after deploy, run migrations against prod database
docker compose exec app npx prisma migrate deploy
```

Note: `prisma migrate deploy` (not `prisma migrate dev`) is the production command. It applies pending migrations without creating new ones.

### Docker Health Check
```yaml
# In docker-compose.yml
services:
  app:
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:4111/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

## Vertex AI & Google Workspace Credential Investigation

**Question from CONTEXT.md:** Are Vertex AI and Google Workspace using the same service account?

**Finding:** They CAN use the same service account, but currently use different credentials:
- **Google Workspace auth:** Uses `GOOGLE_SERVICE_ACCOUNT_KEY` (parsed inline in `google-auth.ts`) with scopes for Drive, Slides, Docs APIs
- **Vertex AI auth:** Uses `GOOGLE_APPLICATION_CREDENTIALS` file (`vertex-service-account.json`) read automatically by `@google/genai` SDK

**Same service account is possible if:** The service account has both:
1. Google Workspace API scopes (Drive, Slides, Docs) via domain-wide delegation
2. Vertex AI User IAM role on the GCP project

**Recommendation:** Check if the existing `vertex-service-account.json` and `GOOGLE_SERVICE_ACCOUNT_KEY` reference the same service account email. If so, use the same JSON for both env vars. If not, keep them separate (two env vars, two JSON values) -- this is the safer approach since they may have different permissions.

For Docker deployment, either way works: `GOOGLE_SERVICE_ACCOUNT_KEY` is already inline JSON (no changes needed), and `VERTEX_SERVICE_ACCOUNT_KEY` is written to a file by the entrypoint script.

## googleapis Bundle Size Investigation

**Question from CONTEXT.md:** Does `googleapis` get imported in the web app?

**Finding:** `googleapis` is NOT imported anywhere in `apps/web/`. It is only used in `apps/agent/src/lib/google-auth.ts`. The web app only communicates with the agent server via HTTP (server actions). No bundle size concern for Vercel deployment.

## Oracle Cloud VM Setup Checklist

### Instance Creation
1. Shape: `VM.Standard.A1.Flex` (ARM64)
2. OCPUs: 2 (free tier allows up to 4)
3. Memory: 12 GB (free tier allows up to 24 GB)
4. Image: Canonical Ubuntu 24.04 aarch64
5. Boot volume: 50 GB (free tier allows up to 200 GB)
6. SSH key: Upload public key during creation

### Networking
1. VCN Security List: Add ingress rules for TCP ports 80, 443
2. VM firewall (Ubuntu): `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT && sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT`
3. Persist iptables: `sudo apt install iptables-persistent && sudo netfilter-persistent save`

### Software Installation
```bash
# Docker
sudo apt update && sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu
```

### DNS
Point subdomain (e.g., `agent.yourdomain.com`) A record to the VM's public IP. Caddy will auto-obtain the TLS certificate once DNS propagates.

## External Service Configuration Checklist

### Google Cloud Console
- [ ] OAuth consent screen: Add production Vercel URL to authorized domains
- [ ] OAuth credentials: Add redirect URIs for production Vercel URL and Supabase callback URL
- [ ] Verify service account(s) have required roles

### Supabase Dashboard (Production Project)
- [ ] Authentication > URL Configuration > Site URL: Set to production Vercel URL
- [ ] Authentication > URL Configuration > Redirect URLs: Add preview URL pattern (e.g., `https://*-your-vercel-team.vercel.app/**`)
- [ ] Authentication > Providers > Google: Verify OAuth client ID and secret

### Domain Registrar
- [ ] A record: `agent.yourdomain.com` -> Oracle VM public IP
- [ ] Wait for DNS propagation before starting Caddy

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nginx + Certbot + cron | Caddy auto-TLS | Caddy v2 (2020+) | Zero-config TLS, no renewal scripts |
| `docker-compose` (v1) | `docker compose` (v2 plugin) | 2022 | Built into Docker CLI, no separate binary |
| `@google-cloud/vertexai` SDK | `@google/genai` SDK | June 2025 (deprecated June 2026) | Unified SDK for Gemini + Vertex AI |
| Vercel `vercel.json` build config | Dashboard root directory + auto-detection | 2023+ | Simpler for monorepos, auto-detects Turborepo |

## Open Questions

1. **Same or different service accounts for Vertex AI and Workspace?**
   - What we know: Both use service account JSON. `vertex-service-account.json` exists as a file; `GOOGLE_SERVICE_ACCOUNT_KEY` is inline JSON in `.env`.
   - What's unclear: Whether they reference the same service account or different ones.
   - Recommendation: Check during implementation. If same, use one env var. If different, keep two (both work fine with entrypoint script approach).

2. **Supabase pooler URL reliability for production**
   - What we know: STATE.md notes "Supabase pooler URLs may work after propagation delay; test before production"
   - What's unclear: Whether the production Supabase pooler is ready and working
   - Recommendation: Test pooler URL connectivity during deployment. Fall back to direct URL if pooler has issues.

3. **Mastra build output dependencies**
   - What we know: `.mastra/output/` contains bundled MJS files. `package.json` in output has empty dependencies. But Prisma client is a native addon.
   - What's unclear: Exact list of native modules that need to be copied to the production Docker image
   - Recommendation: Start with Prisma client copy. Add others if runtime errors occur. Test with `docker compose up` before going live.

## Sources

### Primary (HIGH confidence)
- `@google/genai` v1.43.0 type definitions (local `node_modules`) -- verified `googleAuthOptions` constructor parameter accepts `GoogleAuthOptions.credentials` for inline JSON
- `google-auth-library` v9.15.1 source (local `node_modules`) -- verified `GOOGLE_APPLICATION_CREDENTIALS` only accepts file paths via `fs.realpathSync()`
- `apps/agent/src/env.ts`, `apps/web/src/env.ts` -- verified all required env vars and their validation
- `apps/agent/src/lib/google-auth.ts` -- verified Google Workspace auth uses inline JSON parsing
- Grep of `apps/web/` -- verified `googleapis` is NOT imported in web app
- [Vercel Monorepo Documentation](https://vercel.com/docs/monorepos) -- root directory setting, pnpm auto-detection, Turborepo integration
- [Mastra Deployment Overview](https://mastra.ai/docs/deployment/overview) -- Node.js v22.13.0+, `mastra build` output, `node index.mjs` execution
- [Mastra Server Deployment](https://mastra.ai/docs/deployment/mastra-server) -- PORT env var, `.mastra/output/` self-contained, `mastra start` vs `node index.mjs`
- [Mastra AWS Lambda Guide](https://mastra.ai/guides/deployment/aws-lambda) -- Dockerfile pattern with `node:22-alpine`, `apk add gcompat`

### Secondary (MEDIUM confidence)
- [Oracle Cloud Free Tier Docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) -- Ampere A1 free tier limits (4 OCPUs, 24 GB RAM)
- [Caddy Reverse Proxy Quick-Start](https://caddyserver.com/docs/quick-starts/reverse-proxy) -- Caddyfile syntax, auto-TLS behavior
- [Docker Compose Environment Variables](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/) -- env_file, entrypoint patterns
- [Vercel Environment Variables Docs](https://vercel.com/docs/environment-variables) -- per-environment scoping

### Tertiary (LOW confidence)
- [OneUpTime Blog: Docker on Oracle Cloud Free Tier](https://oneuptime.com/blog/post/2026-02-08-how-to-set-up-docker-on-an-oracle-cloud-free-tier-instance/view) -- Docker installation steps on Ubuntu ARM64 (community guide)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools verified via official docs and local codebase inspection
- Architecture: HIGH -- Docker + Caddy + Vercel is well-documented and battle-tested
- Pitfalls: HIGH -- verified `GOOGLE_APPLICATION_CREDENTIALS` file-only limitation in actual source code; Vercel monorepo patterns confirmed via official docs
- Vertex AI auth: HIGH -- verified `googleAuthOptions.credentials` in actual `.d.ts` files

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (30 days -- stable deployment tooling)
