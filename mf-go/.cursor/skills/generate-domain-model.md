# Skill: Generate Domain Model

## Trigger
Use this skill when asked to: "create a domain model", "add entity", "define model"

## Inputs Required
- `<context>` — bounded context name (e.g., `iam`, `settings`, `billing`)
- `<Entity>` — PascalCase entity name (e.g., `User`, `Invoice`)
- fields — list of domain fields with types

## Output Files

### `internal/domain/<context>/model/<entity>.go`
```go
package model

import (
    "time"
    "github.com/google/uuid"
)

type <Entity> struct {
    ID        uuid.UUID
    // domain-specific fields
    Status    <Entity>Status
    CreatedAt time.Time
    UpdatedAt time.Time
}

type <Entity>Status string

const (
    <Entity>StatusActive   <Entity>Status = "active"
    <Entity>StatusInactive <Entity>Status = "inactive"
)
```

### `internal/domain/<context>/repository/<entity>_repository.go`
```go
package repository

import (
    "context"
    "github.com/google/uuid"
    "<module>/internal/domain/<context>/model"
)

type <Entity>Repository interface {
    Create(ctx context.Context, entity *model.<Entity>) error
    FindByID(ctx context.Context, id uuid.UUID) (*model.<Entity>, error)
    Update(ctx context.Context, entity *model.<Entity>) error
    Delete(ctx context.Context, id uuid.UUID) error
}
```

### `internal/domain/<context>/event/<entity>_events.go`
```go
package event

import (
    "time"
    "github.com/google/uuid"
)

const <Entity>CreatedTopic = "<context>.<entity>.created"

type <Entity>Created struct {
    EntityID   uuid.UUID `json:"entity_id"`
    OccurredAt time.Time `json:"occurred_at"`
}
```

## Validation Rules
- No DB/JSON struct tags on domain structs
- No external package imports (only stdlib + uuid)
- Status type must be a typed string const
- Repository interface in its own file
