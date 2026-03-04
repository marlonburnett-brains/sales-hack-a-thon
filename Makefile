.PHONY: run dev install build lint db-generate db-migrate seed

# Start both agent and web dev servers
run:
	pnpm dev

# Aliases
dev: run

# Install dependencies
install:
	pnpm install

# Build all apps
build:
	pnpm build

# Lint all apps
lint:
	pnpm lint

# Database commands (agent)
db-generate:
	pnpm --filter agent db:generate

db-migrate:
	pnpm --filter agent db:migrate

seed:
	pnpm --filter agent seed
