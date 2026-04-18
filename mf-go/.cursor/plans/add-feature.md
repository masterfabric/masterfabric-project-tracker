# Plan: Add New Feature

## Overview
Step-by-step plan for adding a complete feature to MasterFabric Go Basic, from domain through GraphQL delivery and SDK sync.

## Steps

### 1. Domain Layer
- [ ] Define entity struct in `internal/domain/<context>/model/<entity>.go`
  - `ID uuid.UUID`, typed status enums, `CreatedAt/UpdatedAt time.Time`
  - Zero external imports
- [ ] Define repository interface in `internal/domain/<context>/repository/<entity>_repository.go`
- [ ] Define domain event in `internal/domain/<context>/event/<event>.go`
  - JSON-serializable struct + routing key constant

### 2. Application Layer
- [ ] Create DTOs in `internal/application/<context>/dto/`
  - `<feature>_request.go` — input struct
  - `<feature>_response.go` — output struct (never expose domain model directly)
- [ ] Create use case in `internal/application/<context>/usecase/<operation>.go`
  - Constructor: `NewXxxUseCase(...) *XxxUseCase`
  - Single method: `Execute(ctx, req) (resp, error)`
  - Publish domain event after successful DB write

### 3. Infrastructure Layer
- [ ] Implement repository in `internal/infrastructure/postgres/<context>/<entity>_repository.go`
  - Use `pgxpool.Pool`
  - Add compile-time interface check: `var _ repo.Interface = (*Impl)(nil)`
  - Wrap errors with context
- [ ] Write SQL migration in `internal/infrastructure/postgres/migrations/`
  - `YYYYMMDDHHMMSS_add_<feature>.sql` (goose format, Up + Down)

### 4. GraphQL Layer
- [ ] Add types to `internal/infrastructure/graphql/schema/<context>.graphqls`
  - New type, input, payload, query/mutation entries
- [ ] Run schema generation: `go generate ./internal/infrastructure/graphql/...`
- [ ] Implement resolver method in `internal/infrastructure/graphql/resolver/<context>_resolver.go`
  - Map GraphQL input → DTO → call use case → map response → return payload
  - Add auth context check if operation requires authentication

### 5. Dependency Wiring
- [ ] Register new repository + use case in `cmd/server/main.go`
- [ ] Inject use case into resolver struct

### 6. SDK Sync
- [ ] Run `make generate-all` to regenerate Dart + Swift SDKs
- [ ] Verify `sdk/dart_go_api/` and `sdk/swift_go_api/` updated correctly

### 7. Tests
- [ ] Unit test for use case (table-driven, mock repository)
- [ ] Integration test for repository (tagged `//go:build integration`)

## Verification
```bash
go build -o /tmp/masterfabric-basic ./cmd/server   # must compile
go test ./...                                       # unit tests must pass
go vet ./...                                        # no vet errors
make generate-all                                   # SDKs in sync
```
