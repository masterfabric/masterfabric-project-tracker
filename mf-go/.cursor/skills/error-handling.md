# Skill: Error Handling

## Trigger
Use this skill when asked to: "add error handling", "define domain error", "handle error", "map errors"

## Domain Sentinel Errors

### Definition (in domain or shared/errors package)
```go
package errors

import "fmt"

type DomainError struct {
    Code    string
    Message string
    Cause   error
}

func (e *DomainError) Error() string {
    if e.Cause != nil {
        return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Cause)
    }
    return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func (e *DomainError) Unwrap() error { return e.Cause }

func New(code, message string, cause error) *DomainError {
    return &DomainError{Code: code, Message: message, Cause: cause}
}
```

### Sentinel Variable Declaration
```go
// internal/domain/<context>/errors.go or internal/shared/errors/errors.go
var (
    ErrUserNotFound    = errors.New("USER_NOT_FOUND",    "user not found",               nil)
    ErrEmailTaken      = errors.New("EMAIL_TAKEN",       "email already in use",         nil)
    ErrInvalidCreds    = errors.New("INVALID_CREDENTIALS","invalid email or password",   nil)
    ErrTokenExpired    = errors.New("TOKEN_EXPIRED",     "token has expired",            nil)
    ErrTokenInvalid    = errors.New("TOKEN_INVALID",     "token is invalid",             nil)
    ErrUnauthorized    = errors.New("UNAUTHORIZED",      "authentication required",      nil)
    ErrForbidden       = errors.New("FORBIDDEN",         "access denied",               nil)
)
```

## Error Wrapping Patterns

### Application layer (use case)
```go
if err := uc.repo.Create(ctx, user); err != nil {
    return nil, fmt.Errorf("RegisterUseCase.Execute: %w", err)
}
```

### Infrastructure layer (repository)
```go
if err := row.Scan(&u.ID); err != nil {
    if errors.Is(err, pgx.ErrNoRows) {
        return nil, domainErr.ErrUserNotFound
    }
    return nil, fmt.Errorf("userRepo.FindByEmail: %w", err)
}
```

### GraphQL layer (resolver)
```go
// Do NOT wrap further — just pass through
resp, err := r.loginUseCase.Execute(ctx, req)
if err != nil {
    return nil, err  // gqlgen will format this as a GraphQL error
}
```

## GraphQL Error Extensions
```go
// Map domain error code to GraphQL extensions
func toGraphQLError(err error) error {
    var de *domainErrors.DomainError
    if errors.As(err, &de) {
        return &gqlerror.Error{
            Message: de.Message,
            Extensions: map[string]any{
                "code": de.Code,
            },
        }
    }
    return err
}
```

## Never Do
```go
// FORBIDDEN — swallowing errors
_ = someOperation()

// FORBIDDEN — panic in business logic
panic("something went wrong")

// FORBIDDEN — returning raw DB error to GraphQL
return nil, pgxErr  // must map to domain error first
```

## Checklist
- [ ] Sentinel errors defined with `errors.New(code, message, nil)`
- [ ] All wrapping uses `fmt.Errorf("context: %w", err)`
- [ ] `pgx.ErrNoRows` mapped to domain `ErrXxxNotFound`
- [ ] GraphQL layer includes `code` extension field
- [ ] No `_ = err` anywhere in production code
- [ ] No `panic()` outside of `main()` startup
