# Plan: Write Tests

## Overview
Plan for writing unit and integration tests in MasterFabric Go Basic following the project's testing conventions.

## Test Taxonomy

| Type        | Tag              | Location                                    | DB? |
|-------------|------------------|---------------------------------------------|-----|
| Unit        | (none)           | Same package as subject, `_test.go`         | No  |
| Integration | `integration`    | `internal/infrastructure/postgres/<ctx>/`   | Yes |
| E2E         | `e2e`            | `test/e2e/`                                 | Yes |

## Steps

### 1. Unit Tests (Use Cases)
- [ ] File: `internal/application/<context>/usecase/<operation>_test.go`
- [ ] Package: `package usecase_test` (black-box)
- [ ] Mock repository interfaces using `testify/mock` or manual mock structs
- [ ] Use table-driven test pattern
- [ ] Test success path + all error paths

```go
package usecase_test

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
    "<module>/internal/application/<context>/dto"
    "<module>/internal/application/<context>/usecase"
)

type MockXxxRepo struct{ mock.Mock }

func (m *MockXxxRepo) Create(ctx context.Context, entity *model.Xxx) error {
    args := m.Called(ctx, entity)
    return args.Error(0)
}

func TestXxxUseCase_Execute(t *testing.T) {
    tests := []struct {
        name    string
        req     *dto.XxxRequest
        mockFn  func(*MockXxxRepo)
        want    *dto.XxxResponse
        wantErr bool
    }{
        {
            name: "success",
            req:  &dto.XxxRequest{},
            mockFn: func(m *MockXxxRepo) {
                m.On("Create", mock.Anything, mock.Anything).Return(nil)
            },
            want:    &dto.XxxResponse{},
            wantErr: false,
        },
        // error cases...
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            repo := &MockXxxRepo{}
            tt.mockFn(repo)
            uc := usecase.NewXxxUseCase(repo, nil)
            got, err := uc.Execute(context.Background(), tt.req)
            if tt.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
                assert.Equal(t, tt.want, got)
            }
            repo.AssertExpectations(t)
        })
    }
}
```

### 2. Integration Tests (Repositories)
- [ ] File: `internal/infrastructure/postgres/<context>/<entity>_repository_integration_test.go`
- [ ] Build tag: `//go:build integration`
- [ ] Use a real test DB (from `docker-compose.yml`)
- [ ] Clean up after each test (`t.Cleanup`)

```go
//go:build integration

package iam_test

import (
    "context"
    "os"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/stretchr/testify/require"
)

func TestUserRepository_Integration(t *testing.T) {
    pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
    require.NoError(t, err)
    t.Cleanup(pool.Close)
    // ...
}
```

### 3. Running Tests
```bash
# Unit tests only
go test ./...

# Integration tests (requires running Postgres)
go test -tags integration ./internal/infrastructure/postgres/...

# Single test
go test -run TestXxxUseCase_Execute ./internal/application/<context>/usecase/

# With race detector
go test -race ./...

# With coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## Checklist
- [ ] Black-box test packages (`package xxx_test`)
- [ ] Table-driven tests for all use cases
- [ ] Mock interfaces, not concrete implementations
- [ ] Integration tests tagged with `//go:build integration`
- [ ] `t.Cleanup` for all integration test resources
- [ ] `go test -race ./...` passes
