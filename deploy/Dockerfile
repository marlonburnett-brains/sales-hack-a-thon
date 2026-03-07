# Multi-stage Docker build for the Mastra agent server
# Targets ARM64 (Oracle Cloud Ampere A1) via node:22-alpine multi-arch image

# --- Builder stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy monorepo root files for workspace resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace dependencies
COPY packages/ ./packages/

# Copy patches (referenced by pnpm patchedDependencies)
COPY patches/ ./patches/

# Copy agent app
COPY apps/agent/ ./apps/agent/

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Switch to agent directory for build
WORKDIR /app/apps/agent

# Generate Prisma client (native addon, must match target architecture)
RUN npx prisma generate

# Build agent server (produces .mastra/output/)
RUN pnpm build

# Overwrite mastra output's @prisma/client with the generated one (includes schema types + engine)
RUN GENERATED_CLIENT=$(find /app/node_modules/.pnpm -path "*/node_modules/@prisma/client" -type d | head -1) && \
    rm -rf .mastra/output/node_modules/@prisma/client && \
    cp -r "$GENERATED_CLIENT" .mastra/output/node_modules/@prisma/client && \
    PRISMA_ENGINE_DIR=$(find /app/node_modules/.pnpm -path "*/node_modules/.prisma" -type d | head -1) && \
    if [ -n "$PRISMA_ENGINE_DIR" ]; then cp -r "$PRISMA_ENGINE_DIR" .mastra/output/node_modules/.prisma; fi

# --- Production stage ---
FROM node:22-alpine

# gcompat provides GNU libc compatibility for native modules (Prisma)
RUN apk add --no-cache gcompat

WORKDIR /app

# Copy mastra build output (includes bundled app + node_modules with generated Prisma client)
COPY --from=builder /app/apps/agent/.mastra/output/ ./

# Copy entrypoint script
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mastra -u 1001 && \
    chown -R mastra:nodejs /app

USER mastra

ENV NODE_ENV=production
ENV PORT=4111

EXPOSE 4111

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "index.mjs"]
