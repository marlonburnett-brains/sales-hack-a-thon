# Phase 17: Deployment & Go-Live - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the platform to production URLs — web app on Vercel, agent server on Oracle Cloud Ampere A1 VM with HTTPS via Caddy reverse proxy. Correct environment separation (prod Supabase for production, dev Supabase for preview). All existing workflows (Touch 1-4, Pre-Call Briefing) must complete end-to-end using production URLs. Does NOT include monitoring dashboards, alerting, custom domains, or performance optimization.

</domain>

<decisions>
## Implementation Decisions

### Oracle VM provisioning
- VM does not exist yet — plan includes full provisioning steps (Oracle Cloud console walkthrough)
- Plan covers: instance creation, networking (ports 80/443 open), SSH key setup, then Docker + Caddy + app installation
- Plan includes a manual steps checklist for Google Cloud Console (OAuth redirect URIs) and Supabase dashboard (prod URL configuration)

### Agent deploy workflow
- GitHub repo exists — can use for deploy automation
- Brief restart is acceptable (docker compose down + up) — no zero-downtime requirement for internal tool

### URL & domain strategy
- A domain is available for the agent server — can point a subdomain at the Oracle VM IP for Caddy auto-TLS via Let's Encrypt

### Vertex AI auth
- Not sure if Vertex AI and Google Workspace use the same service account — Claude will investigate and determine the right approach

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

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraints:
- Must work with existing monorepo structure (pnpm + Turborepo)
- `mastra build` produces the agent server build output
- `GOOGLE_SERVICE_ACCOUNT_KEY` is already inline JSON (parsed in `apps/agent/src/lib/google-auth.ts`) — no file path dependency for Workspace API
- `GOOGLE_APPLICATION_CREDENTIALS` (Vertex AI) currently uses a file path — needs resolution for deployed environment
- Health check endpoint (`/health`) is already public (Phase 15) — ready for uptime monitoring
- Separate API keys per environment already decided (Phase 15)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/env.ts`: Full env var validation with Zod — lists all required agent env vars (DATABASE_URL, DIRECT_URL, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_TEMPLATE_PRESENTATION_ID, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, AGENT_API_KEY, MASTRA_PORT)
- `apps/web/src/env.ts`: Web env var validation — AGENT_SERVICE_URL (defaults to localhost:4111), AGENT_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- `apps/agent/src/lib/google-auth.ts`: Google Workspace auth using inline JSON from `GOOGLE_SERVICE_ACCOUNT_KEY` env var — no file dependency
- `apps/agent/.env.example` / `apps/web/.env.example`: Templates for all required env vars
- `/health` endpoint on agent server — public, returns `{ "status": "ok" }` (Phase 15)

### Established Patterns
- `@t3-oss/env-core` / `@t3-oss/env-nextjs` for typed env validation — new deployment env vars should follow this pattern
- Monorepo with pnpm workspaces — `@lumenalta/schemas` is a workspace dependency used by both apps
- `mastra build` for agent server builds, `next build` for web app
- `turbo.json` orchestrates builds with `dependsOn: ["^build", "^db:generate"]`
- All web-to-agent traffic is server-side (Next.js server actions) — API key never exposed to browser

### Integration Points
- `AGENT_SERVICE_URL` in web env — currently defaults to `http://localhost:4111`, must point to Oracle VM HTTPS URL in production
- `DATABASE_URL` / `DIRECT_URL` in agent env — must use prod Supabase connection strings in production
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` in web env — must use prod Supabase project in production, dev in preview
- `GOOGLE_APPLICATION_CREDENTIALS` env var — read automatically by `@google/genai` for Vertex AI, currently file path
- Vercel build must handle the monorepo workspace dependency on `@lumenalta/schemas`
- Oracle VM needs ARM64-compatible Docker images (Ampere A1 is aarch64)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-deployment-go-live*
*Context gathered: 2026-03-05*
