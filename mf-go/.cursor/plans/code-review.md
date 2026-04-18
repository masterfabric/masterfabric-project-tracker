# Plan: Code Review

## Overview
Checklist-driven code review plan for MasterFabric Go Basic pull requests, covering architecture, correctness, security, and style.

## Architecture Review

### Dependency Rule
- [ ] Domain layer has zero external imports (no pgx, redis, etc.)
- [ ] Application layer imports only Domain + standard library
- [ ] Infrastructure imports Domain + Application (no reverse deps)
- [ ] GraphQL layer imports Application DTOs + Infrastructure use cases only
- [ ] Codegen imports only `internal/codegen/*` + third-party tools

### Layer Integrity
- [ ] No domain models returned directly from use cases (use DTOs)
- [ ] No SQL or Redis calls in application layer
- [ ] No business logic in infrastructure layer
- [ ] No business logic in GraphQL resolvers (delegate to use cases)

## Correctness

### Error Handling
- [ ] All errors returned (no `_ = err`)
- [ ] No naked `panic()` in business logic
- [ ] Errors wrapped with context: `fmt.Errorf("scope.Method: %w", err)`
- [ ] Domain sentinel errors used (`var ErrXxx = errors.New(...)`)
- [ ] Raw DB errors not exposed to GraphQL layer

### Auth & Security
- [ ] Auth-protected resolvers call `middleware.UserIDFromContext(ctx)`
- [ ] Password hash never appears in DTOs or GraphQL responses
- [ ] JWT tokens not logged
- [ ] Redis keys follow `mf:{scope}:{id}:{field}` pattern with TTL set
- [ ] ADMIN role checked before every admin operation

### Database
- [ ] `pgxpool.Pool` used (not `database/sql`)
- [ ] Compile-time interface assertion: `var _ repo.Interface = (*Impl)(nil)`
- [ ] SQL migration has both Up and Down sections
- [ ] All DB errors wrapped with function context

### RabbitMQ
- [ ] Domain event published **after** successful DB write (not before)
- [ ] Messages durable + persistent delivery mode
- [ ] Consumers are idempotent

## Code Style
- [ ] Files named `snake_case.go`
- [ ] Packages lowercase single word
- [ ] Constructors follow `NewXxx()` pattern
- [ ] Interfaces named descriptively (no `I` prefix)
- [ ] Context propagated as first argument everywhere
- [ ] `log/slog` used for structured logging (not `fmt.Print*` in production paths)

## GraphQL
- [ ] Mutations return typed `*model.XxxPayload`, not raw scalars
- [ ] Schema updated before resolver implementation
- [ ] `go generate` run after schema changes
- [ ] `make generate-all` run to keep SDKs in sync

## Tests
- [ ] New use cases have table-driven unit tests
- [ ] New repositories have integration tests (tagged `integration`)
- [ ] `go test ./...` passes
- [ ] `go test -race ./...` passes
- [ ] `go vet ./...` passes

## Final Checks
```bash
go build -o /tmp/masterfabric-basic ./cmd/server
go test ./...
go test -race ./...
go vet ./...
make generate-all
```
