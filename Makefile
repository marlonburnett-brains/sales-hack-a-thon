.PHONY: run dev prod install build lint db-generate db-migrate seed set-new push pull env

# Determine environment from command line: make run dev | make run prod
# Defaults to dev
ifeq ($(word 2,$(MAKECMDGOALS)),prod)
  ENV = prod
else
  ENV = dev
endif

# No-op targets so "make run dev" / "make run prod" don't error
dev prod:
	@:

# Start both agent and web dev servers with selected environment
run:
	@cp apps/web/.env.$(ENV) apps/web/.env.local
	@cp apps/agent/.env.$(ENV) apps/agent/.env
	@echo "Running with $(ENV) environment"
	pnpm dev

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

# Secrets management: make set-new env | make push env | make pull env
env:
	@:

set-new:
	@./scripts/secrets.sh keygen

push:
	@./scripts/secrets.sh encrypt

pull:
	@./scripts/secrets.sh decrypt
