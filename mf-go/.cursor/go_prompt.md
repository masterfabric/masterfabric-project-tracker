# Go Clean Architecture Prompt — MasterFabric Go Basic

## Architecture Overview

This project follows **Clean/Hexagonal Architecture** with **DDD** principles.

### Layers (from inside out)
1. **Domain** — Pure Go entities, repository interfaces, domain events. Zero external deps.
2. **Application** — Use cases + DTOs. Depends only on Domain.
3. **Infrastructure** — DB, Cache, Queue, Auth implementations. Depends on Domain + Application.
4. **Delivery (GraphQL)** — gqlgen resolvers. Depends on Application.

### Dependency Rule
```
Delivery → Application → Domain
Infrastructure implements Domain interfaces
```

---

## Domain Layer Rules

```go
// model: pure struct, no tags except json
type User struct {
    ID           uuid.UUID
    Email        string
    PasswordHash string
    DisplayName  string
    AvatarURL    string
    Status       UserStatus
    CreatedAt    time.Time
    UpdatedAt    time.Time
}

// repository interface: depends on nothing external
type UserRepository interface {
    Create(ctx context.Context, user *User) error
    FindByID(ctx context.Context, id uuid.UUID) (*User, error)
    FindByEmail(ctx context.Context, email string) (*User, error)
    Update(ctx context.Context, user *User) error
    Delete(ctx context.Context, id uuid.UUID) error
}
```

---

## Application Layer Rules

```go
// use case: one file per operation, NewXxx constructor
type RegisterUseCase struct {
    userRepo  iam.UserRepository
    authSvc   service.AuthService
    eventBus  events.EventBus
}

func NewRegisterUseCase(userRepo iam.UserRepository, authSvc service.AuthService, bus events.EventBus) *RegisterUseCase {
    return &RegisterUseCase{userRepo: userRepo, authSvc: authSvc, eventBus: bus}
}

func (uc *RegisterUseCase) Execute(ctx context.Context, req *dto.RegisterRequest) (*dto.AuthResponse, error) {
    // 1. validate
    // 2. check uniqueness
    // 3. hash password
    // 4. persist
    // 5. generate tokens
    // 6. publish event
    // 7. return DTO
}
```

---

## Infrastructure Layer Rules

### PostgreSQL Repositories
- Use `pgxpool.Pool` (never `database/sql`)
- SQL inline strings for simple queries
- Named struct scan via `pgx.RowToStructByName` where possible
- Wrap DB errors: `fmt.Errorf("userRepo.Create: %w", err)`

### Redis
- Prefix keys: `mf:{scope}:{id}:{field}`
- Always set TTL
- Use pipeline for multi-ops

### RabbitMQ
- Topic exchange: `masterfabric.events`
- Message body: JSON encoded `events.Event`
- Durable queues, persistent messages

---

## GraphQL Layer Rules

- One resolver file per domain (auth_resolver.go, user_resolver.go, settings_resolver.go)
- Resolver receives use case interfaces, not concrete types
- Return `*model.XxxPayload` from mutations
- Never expose password hashes or internal fields
- Auth middleware puts `user_id` in context; resolvers call `middleware.UserIDFromContext(ctx)`

---

## Error Patterns

```go
// domain errors
var ErrUserNotFound = errors.New("USER_NOT_FOUND", "user not found", nil)
var ErrEmailTaken   = errors.New("EMAIL_TAKEN", "email already in use", nil)
var ErrInvalidCreds = errors.New("INVALID_CREDENTIALS", "invalid email or password", nil)
var ErrTokenExpired = errors.New("TOKEN_EXPIRED", "token has expired", nil)
```

---

## Testing Rules

- Table-driven tests for use cases
- Mock repository interfaces with `testify/mock` or manual mocks
- Test files: `package xxx_test` for black-box
- Never test infrastructure against real DB in unit tests (use integration tag)

---

## Code Style

- `gofmt` + `goimports` always
- No naked `panic()` outside of `main()` startup
- Context propagated everywhere
- Use `log/slog` for structured logging
- Prefer explicit error returns over panics
