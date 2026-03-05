---
phase: 17-deployment-go-live
plan: 01
subsystem: infra
tags: [docker, caddy, deployment, arm64, vertex-ai, oracle-cloud]

# Dependency graph
requires:
  - phase: 15-service-auth
    provides: "Health endpoint (/health) and API key auth for agent server"
  - phase: 14-database-migration
    provides: "Prisma schema and PostgreSQL migration setup"
provides:
  - "Multi-stage Dockerfile for containerized Mastra agent server"
  - "Caddy reverse proxy configuration with auto-TLS"
  - "Docker Compose orchestration for app + Caddy services"
  - "Entrypoint script resolving Vertex AI file-path credential requirement"
  - "SSH deploy script for one-command deployment"
  - "Complete production env var template"
affects: [17-02-vm-provisioning, deployment, production]

# Tech tracking
tech-stack:
  added: [docker, caddy, docker-compose]
  patterns: [multi-stage-docker-build, entrypoint-credential-injection, ssh-deploy]

key-files:
  created:
    - deploy/Dockerfile
    - deploy/entrypoint.sh
    - deploy/docker-compose.yml
    - deploy/Caddyfile
    - deploy/deploy.sh
    - deploy/.env.example
  modified:
    - apps/agent/.env.example
    - .gitignore

key-decisions:
  - "Entrypoint script writes VERTEX_SERVICE_ACCOUNT_KEY JSON to /tmp file for GOOGLE_APPLICATION_CREDENTIALS (zero code changes)"
  - "Caddy domain configurable via AGENT_DOMAIN env var with localhost fallback"
  - "Docker health check uses wget --spider against /health endpoint"
  - "Deploy script uses SSH heredoc for atomic git pull + build + restart"

patterns-established:
  - "Credential injection: env var -> file via entrypoint for SDKs that only accept file paths"
  - "Deploy directory: committed infra files in deploy/, secrets excluded via .gitignore"

requirements-completed: [DEPLOY-05, DEPLOY-06, DEPLOY-07]

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 17 Plan 01: Deployment Infrastructure Summary

**Docker + Caddy deployment files with multi-stage build, Vertex AI credential injection via entrypoint, and SSH deploy script**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T14:13:42Z
- **Completed:** 2026-03-05T14:15:26Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Complete deploy/ directory with all infrastructure files for containerized agent server deployment
- Multi-stage Dockerfile that builds the Mastra agent from the monorepo and produces a minimal production image
- Entrypoint script that resolves the Vertex AI GOOGLE_APPLICATION_CREDENTIALS file-path requirement by writing inline JSON to a temp file at container startup
- Docker Compose with Caddy reverse proxy for automatic HTTPS and Docker restart policies for crash recovery
- SSH deploy script for one-command deployment to Oracle Cloud VM

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Docker and Caddy deployment files** - `eedba05` (feat)
2. **Task 2: Create deploy script and update env examples** - `9738fc8` (feat)

## Files Created/Modified
- `deploy/Dockerfile` - Multi-stage build: node:22-alpine builder + production image with Prisma client
- `deploy/entrypoint.sh` - Writes VERTEX_SERVICE_ACCOUNT_KEY to /tmp/vertex-credentials.json, exports GOOGLE_APPLICATION_CREDENTIALS
- `deploy/docker-compose.yml` - App service (build from Dockerfile, health check) + Caddy service (auto-TLS, HTTP/3)
- `deploy/Caddyfile` - Reverse proxy to app:4111 with configurable domain via AGENT_DOMAIN env var
- `deploy/deploy.sh` - SSH into VM, git pull, docker compose build + restart, health check verification
- `deploy/.env.example` - Complete template for all production env vars organized by section
- `apps/agent/.env.example` - Added VERTEX_SERVICE_ACCOUNT_KEY (commented out, Docker-only)
- `.gitignore` - Added deploy/.env to exclude production secrets

## Decisions Made
- Used entrypoint script approach for Vertex AI credentials (zero code changes to application) rather than modifying @google/genai constructor calls across 8+ files
- Made Caddy domain configurable via AGENT_DOMAIN env var with localhost fallback for local testing
- Used wget --spider for Docker health checks (available in alpine, no curl needed)
- Deploy script runs health check via separate SSH command after 8-second wait for container startup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this plan. VM provisioning and actual deployment happen in Plan 02.

## Next Phase Readiness
- All deployment infrastructure files committed and ready for use
- Plan 02 can reference these files for VM provisioning and actual deployment
- deploy/.env.example documents every environment variable needed on the production VM

---
*Phase: 17-deployment-go-live*
*Completed: 2026-03-05*
