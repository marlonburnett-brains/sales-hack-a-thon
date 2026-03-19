.PHONY: run dev prod install build lint db-generate db-migrate seed set-new push pull env generate generate-tutorial tutorials all

ifneq (,$(filter single:%,$(MAKECMDGOALS)))
%:
	@:
endif

ifneq (,$(filter generate-tutorial,$(MAKECMDGOALS)))
%:
	@:
endif

# Determine environment from command line: make run dev | make run prod
# Defaults to dev
ifeq ($(word 2,$(MAKECMDGOALS)),prod)
  ENV = prod
else
  ENV = dev
endif

# No-op targets so multi-word goals don't error
dev prod tutorials all:
	@:

# Start both agent and web dev servers with selected environment
run:
	@cp apps/web/.env.$(ENV) apps/web/.env.local
	@cp apps/agent/.env.$(ENV) apps/agent/.env
	@pkill -9 -f "mastra.*dev" 2>/dev/null || true
	@pkill -9 -f "\.mastra/output" 2>/dev/null || true
	@lsof -ti :4111 -ti :3000 | xargs kill -9 2>/dev/null || true
	@while lsof -ti :4111 >/dev/null 2>&1; do sleep 0.5; done
	@rm -rf apps/agent/.mastra/output apps/agent/.mastra/.build
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

# Tutorial generation: make generate tutorials | make generate tutorials all | make generate tutorials single:<name>
generate:
	@args="$(filter-out $@,$(MAKECMDGOALS))"; \
	set -- $$args; \
	if [ "$$#" -eq 0 ] || [ "$$1" != "tutorials" ]; then \
		echo "Usage: make generate tutorials [all | single:<tutorial-name>]"; \
		exit 1; \
	fi; \
	shift; \
	if [ "$$#" -eq 0 ] || [ "$$1" = "all" ]; then \
		pnpm --filter tutorials generate; \
	elif printf '%s' "$$1" | grep -q '^single:'; then \
		pnpm --filter tutorials generate --single "$${1#single:}"; \
	else \
		echo "Usage: make generate tutorials [all | single:<tutorial-name>]"; \
		exit 1; \
	fi

# Tutorial shortcut: make generate-tutorial <name>
generate-tutorial:
	@args="$(filter-out $@,$(MAKECMDGOALS))"; \
	set -- $$args; \
	if [ "$$#" -eq 0 ]; then \
		echo "Usage: make generate-tutorial <tutorial-name>"; \
		exit 1; \
	fi; \
	pnpm --filter tutorials generate --single "$$1"
