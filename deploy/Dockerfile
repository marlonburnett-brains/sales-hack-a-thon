# Multi-stage Docker build for the Mastra agent server
# Targets ARM64 (Oracle Cloud Ampere A1) via node:22-alpine multi-arch image

# --- Builder stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Copy monorepo root files for workspace resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace dependencies
COPY packages/ ./packages/

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

# Collect Prisma client from pnpm virtual store to a known location
RUN mkdir -p /prisma-out && \
    cp -r $(find /app/node_modules/.pnpm -path '*/@prisma/client' -type d | head -1)/.. /prisma-out/prisma-parent && \
    cp -r /prisma-out/prisma-parent/.prisma /prisma-out/.prisma && \
    cp -r /prisma-out/prisma-parent/@prisma /prisma-out/@prisma

# --- Production stage ---
FROM node:22-alpine

# gcompat provides GNU libc compatibility for native modules (Prisma)
RUN apk add --no-cache gcompat

WORKDIR /app

# Copy mastra build output (self-contained MJS bundle)
COPY --from=builder /app/apps/agent/.mastra/output/ ./

# Copy Prisma client (runtime native addon, not bundled by mastra build)
COPY --from=builder /prisma-out/.prisma/ ./node_modules/.prisma/
COPY --from=builder /prisma-out/@prisma/ ./node_modules/@prisma/

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
