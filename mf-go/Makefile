.PHONY: all build security-scan run migrate migrate-down migrate-reset seed-admin db-fresh generate generate-dart generate-swift generate-kotlin generate-typescript generate-all tidy lint test docker-up docker-down pgpass-perms clean help

## ── Variables ─────────────────────────────────────────────────────────────────
BINARY      := bin/server
CLI_BINARY  := bin/masterfabric_go
CMD         := ./cmd/server
CLI_CMD     := ./cmd/masterfabric_go
COMPOSE     := docker compose -f deployments/docker-compose.yml

## ── Defaults ──────────────────────────────────────────────────────────────────
all: build

## build: compile the server binary
build:
	@echo "==> Building $(BINARY)"
	@CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(BINARY) $(CMD)

## build-cli: compile the masterfabric_go CLI binary
build-cli:
	@echo "==> Building $(CLI_BINARY)"
	@CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(CLI_BINARY) $(CLI_CMD)

## run: build and run the server locally (requires infra running)
run: build
	@echo "==> Running $(BINARY)"
	@./$(BINARY)

## migrate: run embedded SQL migrations only (uses DATABASE_DSN from env; Postgres must be up)
migrate:
	@echo "==> Running migrations"
	@go run ./cmd/migrate/

## migrate-down: roll back all embedded migrations (drops app tables; uses DATABASE_DSN)
migrate-down:
	@echo "==> Rolling back migrations"
	@go run ./cmd/migrate/ -down

## migrate-reset: roll back all migrations then apply up (fresh schema, same Postgres database)
migrate-reset:
	@echo "==> migrate reset (down + up)"
	@go run ./cmd/migrate/ -reset

## seed-admin: upsert admin user (default email dev@masterfabric.co). Requires SEED_ADMIN_PASSWORD.
## Example: SEED_ADMIN_PASSWORD='your-secure-pass' make seed-admin
## Optional: SEED_ADMIN_EMAIL=you@corp.com make seed-admin
seed-admin:
	@test -n "$$SEED_ADMIN_PASSWORD" || (echo "Set SEED_ADMIN_PASSWORD (e.g. SEED_ADMIN_PASSWORD='...' make seed-admin)" && exit 1)
	@go run ./cmd/seedadmin/ -email="$${SEED_ADMIN_EMAIL:-dev@masterfabric.co}"

## dev: run server with live rebuild on .go / .graphqls changes (Air via go run — no global install)
dev:
	@go run github.com/air-verse/air@v1.61.7

## generate: re-run gqlgen code generation
generate:
	@echo "==> Running gqlgen"
	@go run github.com/99designs/gqlgen generate --config gqlgen.yml

## generate-dart: generate the sdk/dart_go_api Dart package from GraphQL schema
generate-dart: build-cli
	@echo "==> Generating Dart SDK package"
	@$(CLI_BINARY) generate dart

## generate-swift: generate the sdk/swift_go_api Swift/iOS package from GraphQL schema
generate-swift: build-cli
	@echo "==> Generating Swift SDK package"
	@$(CLI_BINARY) generate swift

## generate-kotlin: generate the sdk/kotlin_go_api Kotlin/Android package from GraphQL schema
generate-kotlin: build-cli
	@echo "==> Generating Kotlin SDK package"
	@$(CLI_BINARY) generate kotlin

## generate-typescript: generate the sdk/typescript_go_api TypeScript package from GraphQL schema
generate-typescript: build-cli
	@echo "==> Generating TypeScript SDK package"
	@$(CLI_BINARY) generate typescript

## generate-all: generate Dart, Swift, Kotlin, and TypeScript SDK packages
generate-all: generate-dart generate-swift generate-kotlin generate-typescript


## security-scan: gosec + govulncheck (downloads tools via go run; no global install required)
security-scan:
	@echo "==> gosec"
	@go run github.com/securego/gosec/v2/cmd/gosec@v2.22.0 -quiet \
		-exclude-dir=sdk \
		-exclude-dir=internal/infrastructure/graphql/generated \
		-exclude-dir=internal/codegen \
		./...
	@echo "==> govulncheck"
	@go run golang.org/x/vuln/cmd/govulncheck@v1.1.4 ./...

## tidy: tidy go modules
tidy:
	@go mod tidy

## lint: run golangci-lint (requires: brew install golangci-lint)
lint:
	@golangci-lint run ./...

## test: run all tests
test:
	@go test -race -count=1 ./...

## pgpass-perms: libpq ignores .pgpass if group/other can read; Compose bind-mount keeps host mode
pgpass-perms:
	@chmod 600 deployments/pgadmin/pgpass

## docker-up: start all infrastructure + app containers
docker-up: pgpass-perms
	@$(COMPOSE) up --build -d

## docker-infra: start postgres, redis, rabbitmq, pgadmin, mailpit (no app container)
## Mailpit: SMTP localhost:1025, web UI http://localhost:8025 — use for local OTP email (see .env.example).
docker-infra: pgpass-perms
	@$(COMPOSE) up -d postgres redis rabbitmq pgadmin mailpit

## docker-down: stop and remove containers
docker-down:
	@$(COMPOSE) down

## db-reset: stop infra and remove ALL compose volumes (postgres + redis + rabbitmq), then start infra (no migrations)
db-reset:
	@$(COMPOSE) down -v
	@echo "==> Starting fresh infra"
	@$(MAKE) docker-infra

## db-fresh: db-reset + wait for Postgres + run migrations (full local DB teardown and re-setup)
db-fresh: db-reset
	@echo "==> Waiting for Postgres (localhost:5433)"
	@i=0; until $(COMPOSE) exec -T postgres pg_isready -U masterfabric -d masterfabric_basic 2>/dev/null; do \
		i=$$((i+1)); test $$i -le 60 || (echo "Postgres did not become ready in time" && exit 1); sleep 1; \
	done
	@$(MAKE) migrate
	@echo "==> db-fresh complete. Optional: SEED_ADMIN_PASSWORD='...' make seed-admin"

## docker-logs: tail app container logs
docker-logs:
	@$(COMPOSE) logs -f app

## clean: remove built binaries
clean:
	@rm -rf bin/

## help: print this message
help:
	@grep -E '^## ' Makefile | sed 's/^## //'
