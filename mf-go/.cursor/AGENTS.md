# MasterFabric Go Basic — Agent Conventions

**Monorepo:** repo-root `.cursor/AGENTS.md` defines **`AGENTS_BASE_VERSION`** and shared Git commit conventions (`feat(scope):`, `GFG-XX`, `mf-go:` styles). Follow those when/commits touch multiple packages or when bumping agent guidance.

## Project Overview

**masterfabric_go_basic** is a mobile-backend focused, clean-architecture Go service providing:
- **Auth** (register, login, refresh token, logout)
- **User** (profile CRUD)
- **Settings** (app/user settings)
- **Admin** (user management, role changes, suspend/reactivate — requires ADMIN role)

Exposed via **GraphQL** (gqlgen). No REST API.

## Tech Stack

- **Language**: Go 1.22+
- **API**: GraphQL via gqlgen
- **Router**: go-chi/chi/v5 (only for mounting the GraphQL endpoint)
- **Database**: PostgreSQL via pgx/v5 + pgxpool
- **Cache**: Redis via go-redis/v9
- **Queue**: RabbitMQ via rabbitmq/amqp091-go
- **Auth**: JWT (golang-jwt/jwt/v5) + bcrypt
- **CLI**: cobra (spf13/cobra) — `masterfabric_go` code-generation binary

## Architecture

- **Pattern**: DDD (Domain-Driven Design) + Clean/Hexagonal Architecture
- **Layers**: Domain → Application → Infrastructure → GraphQL (delivery)
- **Event-Driven**: Domain events via RabbitMQ for async side-effects

## Project Structure

```
cmd/
  server/main.go                                # Entry point, dependency injection
  masterfabric_go/main.go                       # Code-generation CLI entry point
internal/
  domain/
    iam/
      model/                                    # User, Role entities
      repository/                               # Repository interfaces
      event/                                    # Domain events
    settings/
      model/                                    # UserSettings, AppSettings entities
      repository/                               # Repository interfaces
      event/                                    # Domain events
  application/
    auth/
      usecase/                                  # Register, Login, Refresh, Logout
      dto/                                      # Request/Response DTOs
    user/
      usecase/                                  # GetProfile, UpdateProfile, DeleteAccount
      dto/                                      # Request/Response DTOs
    settings/
      usecase/                                  # GetSettings, UpdateSettings
      dto/                                      # Request/Response DTOs
  infrastructure/
    postgres/
      iam/                                      # PostgreSQL user repository
      settings/                                 # PostgreSQL settings repository
      migrations/                               # SQL migrations (goose style)
    redis/                                      # Redis client + helpers
    rabbitmq/                                   # RabbitMQ event bus
    auth/                                       # JWT service + bcrypt helper
    graphql/
      resolver/                                 # gqlgen resolvers
      schema/                                   # GraphQL schema (.graphqls files)  ← source of truth for SDK gen
  codegen/
    parser/schema_parser.go                     # GraphQL schema parser (vektah/gqlparser)
    dart/
      generator.go                              # Dart package orchestrator
      models.go                                 # Dart model/enum/input generators
      queries.go                                # Dart gql() DocumentNode generators
      client.go                                 # Dart typed client generator
      pubspec.go                                # pubspec.yaml + barrel export generator
    swift/
      generator.go                              # Swift package orchestrator
      models.go                                 # Swift Codable structs, enums, inputs + Package.swift
      queries.go                                # Swift GraphQL operation string constants (MasterFabricDocuments)
      client.go                                 # Swift async/await URLSession typed client
  shared/
    config/                                     # Viper/env config
    logger/                                     # slog structured logger
    middleware/                                 # Auth, RequestID middleware
    errors/                                     # Domain error types
    events/                                     # EventBus interface
    database/                                   # Postgres pool helper
    cache/                                      # Redis client helper
    version/                                    # Service name/version constants
deployments/
  docker-compose.yml                            # Postgres, Redis, RabbitMQ
  Dockerfile
sdk/
  dart_go_api/                                  # GENERATED — do not edit by hand
    pubspec.yaml
    lib/
      dart_go_api.dart                          # Barrel export
      src/
        models/                                 # enums.dart, inputs.dart, models.dart
        queries/                                # documents.dart (gql DocumentNodes)
        client/                                 # masterfabric_client.dart
  swift_go_api/                                 # GENERATED — do not edit by hand
    Package.swift                               # SPM manifest (Apollo iOS dep)
    Sources/
      MasterFabricAPI/
        Models/                                 # Enums.swift, Inputs.swift, Models.swift
        Queries/                                # Documents.swift (MasterFabricDocuments enum)
        Client/                                 # MasterFabricClient.swift (async/await URLSession)
```

## Key Conventions

### Naming
- Files: `snake_case.go`
- Packages: `lowercase` single word
- Interfaces: Descriptive, no `I` prefix (`UserRepository`, not `IUserRepository`)
- Constructors: `NewXxx()` functions
- Errors: `ErrXxx` sentinel variables

### Dependency Rule (strict)
```
GraphQL Resolvers → Application → Domain ← Infrastructure
```
- **Domain** has zero external imports
- **Application** imports only Domain
- **Infrastructure** imports Domain + Application
- **GraphQL** imports Application (DTOs) + Infrastructure (use cases)
- **codegen** is a standalone tooling layer — imports only `internal/codegen/*` and third-party libs; never imports Application or Domain

### Error Handling
- Return `error` as last value
- Use `errors.New(code, message, cause)` from `shared/errors`
- Wrap with context: `fmt.Errorf("failed to X: %w", err)`

### Auth
- JWT access token (15 min) + refresh token (7 days)
- Refresh tokens stored in Redis with expiry
- Blacklisted tokens stored in Redis on logout

### GraphQL Patterns
- Mutations return typed payload objects (not raw booleans)
- All auth-required operations check context for `user_id`
- Errors follow GraphQL error extensions format with `code` field

### Events (RabbitMQ)
- Exchange: `masterfabric.events` (topic)
- Routing keys: `iam.user.registered`, `iam.user.login`, `settings.updated`, etc.
- Consumers are idempotent

## Common Patterns

### Adding a New Feature
1. Define model in `internal/domain/<context>/model/`
2. Define repository interface in `internal/domain/<context>/repository/`
3. Create use case in `internal/application/<context>/usecase/`
4. Create DTO in `internal/application/<context>/dto/`
5. Implement repository in `internal/infrastructure/postgres/<context>/`
6. Add GraphQL schema in `internal/infrastructure/graphql/schema/<context>.graphqls`
7. Wire resolver in `internal/infrastructure/graphql/resolver/`
8. Wire dependencies in `cmd/server/main.go`
    9. **Re-generate the SDKs** — run `make generate-all` so both Dart and Swift packages stay in sync

### SDK Code Generation Rule
> **Every time a `.graphqls` schema file is added or changed, `make generate-all` must be run.**
> The generated output in `sdk/dart_go_api/` and `sdk/swift_go_api/` is never edited by hand.

The generation pipeline:
```
internal/infrastructure/graphql/schema/*.graphqls
        │
        ▼  internal/codegen/parser  (schema_parser.go)
        │
        ├──▶  internal/codegen/dart   → sdk/dart_go_api/
        │     (generator.go, models.go, queries.go, client.go, pubspec.go)
        │
        └──▶  internal/codegen/swift  → sdk/swift_go_api/
              (generator.go, models.go, queries.go, client.go)
```

### Adding a New SDK Target
1. Create `internal/codegen/<target>/` package mirroring the existing package structure
2. Implement `Generate(schemaDir, outputDir string) error` as the entry point
3. Register the command in `cmd/masterfabric_go/main.go`
4. Add `make generate-<target>` target in `Makefile`
5. Output goes to `sdk/<target>_go_api/`

## Build Commands

```bash
# Server
go build -o /tmp/masterfabric-basic ./cmd/server
go test ./...
go generate ./internal/infrastructure/graphql/...
go vet ./...

# CLI / SDK generation
go build -o bin/masterfabric_go ./cmd/masterfabric_go
./bin/masterfabric_go generate dart
./bin/masterfabric_go generate dart --schema internal/infrastructure/graphql/schema --output sdk/dart_go_api
./bin/masterfabric_go generate swift
./bin/masterfabric_go generate swift --schema internal/infrastructure/graphql/schema --output sdk/swift_go_api

# Via Makefile
make build-cli          # compile bin/masterfabric_go
make generate-dart      # build CLI + regenerate sdk/dart_go_api
make generate-swift     # build CLI + regenerate sdk/swift_go_api
make generate-all       # build CLI + regenerate both SDKs
```
