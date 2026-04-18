# Skill: Generate Use Case

## Trigger
Use this skill when asked to: "create use case", "add operation", "implement use case"

## Inputs Required
- `<context>` — bounded context (e.g., `auth`, `user`, `settings`)
- `<Operation>` — PascalCase operation name (e.g., `Register`, `UpdateProfile`)
- dependencies — list of repositories/services needed

## Output Files

### `internal/application/<context>/dto/<operation>_dto.go`
```go
package dto

type <Operation>Request struct {
    // input fields...
}

type <Operation>Response struct {
    // output fields (never include domain model directly)
}
```

### `internal/application/<context>/usecase/<operation>.go`
```go
package usecase

import (
    "context"
    "fmt"

    domainRepo "<module>/internal/domain/<context>/repository"
    domainEvent "<module>/internal/domain/<context>/event"
    "<module>/internal/application/<context>/dto"
    "<module>/internal/shared/events"
)

type <Operation>UseCase struct {
    repo     domainRepo.<Entity>Repository
    eventBus events.EventBus
}

func New<Operation>UseCase(
    repo domainRepo.<Entity>Repository,
    bus events.EventBus,
) *<Operation>UseCase {
    return &<Operation>UseCase{repo: repo, eventBus: bus}
}

func (uc *<Operation>UseCase) Execute(
    ctx context.Context,
    req *dto.<Operation>Request,
) (*dto.<Operation>Response, error) {
    // 1. validate input
    if req.Field == "" {
        return nil, fmt.Errorf("<Operation>UseCase: field is required")
    }

    // 2. business logic

    // 3. persist
    if err := uc.repo.Create(ctx, entity); err != nil {
        return nil, fmt.Errorf("<Operation>UseCase.Execute: %w", err)
    }

    // 4. publish domain event
    _ = uc.eventBus.Publish(ctx, domainEvent.<Entity>CreatedTopic, domainEvent.<Entity>Created{
        EntityID:   entity.ID,
        OccurredAt: entity.CreatedAt,
    })

    // 5. return DTO
    return &dto.<Operation>Response{}, nil
}
```

## Validation Rules
- Single `Execute` method on use case struct
- Domain event published **after** successful DB write
- Return DTO, never domain model
- Errors wrapped with `fmt.Errorf`
- No infrastructure imports
