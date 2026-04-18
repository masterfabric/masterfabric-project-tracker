# Plan: Debug Issue

## Overview
Structured debugging workflow for issues in MasterFabric Go Basic — from reproduction through root cause to fix and verification.

## Steps

### 1. Reproduce
- [ ] Identify which layer the issue is in (Domain / Application / Infrastructure / GraphQL)
- [ ] Write a minimal reproduction:
  - For use case bugs: write a failing table-driven test
  - For resolver bugs: use the GraphQL playground or a `curl` mutation
  - For DB bugs: query PostgreSQL directly with `psql`
- [ ] Confirm error message and stack trace

### 2. Identify Layer
| Symptom | Likely Layer |
|---------|-------------|
| Wrong business logic | Application (use case) |
| Data not persisting | Infrastructure (repository) |
| GraphQL schema mismatch | GraphQL (schema / resolver) |
| Auth token rejected | Infrastructure (JWT service / Redis) |
| Event not consumed | Infrastructure (RabbitMQ consumer) |
| SDK type mismatch | Codegen |

### 3. Trace the Call Path
```
GraphQL Mutation
  └─▶ Resolver (auth_resolver.go)
        └─▶ Use Case Execute()
              ├─▶ Repository (postgres)
              ├─▶ Auth Service (JWT/bcrypt)
              └─▶ Event Bus (RabbitMQ)
```
- Add `log/slog` debug statements at each boundary
- Check `context` is propagated correctly
- Verify error wrapping chain with `errors.Is` / `errors.As`

### 4. Fix
- [ ] Fix in the correct layer (do not fix domain bugs in infrastructure)
- [ ] Follow error handling conventions:
  - Wrap: `fmt.Errorf("contextName.Method: %w", err)`
  - Domain sentinel: `var ErrXxx = errors.New("CODE", "message", nil)`
- [ ] Never swallow errors (`_ = err` is forbidden)

### 5. Verify
- [ ] Failing test now passes
- [ ] `go test ./...` — all tests pass
- [ ] `go vet ./...` — no vet issues
- [ ] `go build -o /tmp/masterfabric-basic ./cmd/server` — compiles clean

### 6. Document
- [ ] If it was a missing domain error, add it to `internal/shared/errors/` or the relevant domain event file
- [ ] If it exposed a missing test case, add to the test suite
