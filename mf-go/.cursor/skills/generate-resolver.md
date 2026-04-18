# Skill: Generate GraphQL Schema + Resolver

## Trigger
Use this skill when asked to: "add GraphQL operation", "create resolver", "add mutation", "add query"

## Inputs Required
- `<context>` — domain context (e.g., `auth`, `user`, `settings`, `admin`)
- `<Entity>` — PascalCase entity name
- operation type — `Query` or `Mutation`
- auth required — yes/no

## Output Files

### Schema: `internal/infrastructure/graphql/schema/<context>.graphqls`
```graphql
# Add to existing schema or create new file

type <Entity> {
  id:        ID!
  # fields (never include passwordHash or internal fields)
  createdAt: Time!
  updatedAt: Time!
}

input Create<Entity>Input {
  # mutable input fields
}

input Update<Entity>Input {
  # optional mutable fields
}

type <Entity>Payload {
  <entity>: <Entity>!
}

extend type Query {
  get<Entity>(id: ID!): <Entity>!
}

extend type Mutation {
  create<Entity>(input: Create<Entity>Input!): <Entity>Payload!
  update<Entity>(id: ID!, input: Update<Entity>Input!): <Entity>Payload!
  delete<Entity>(id: ID!): Boolean!
}
```

### After Schema Change
```bash
go generate ./internal/infrastructure/graphql/...
make generate-all
```

### Resolver: `internal/infrastructure/graphql/resolver/<context>_resolver.go`
```go
package resolver

import (
    "context"

    "<module>/internal/application/<context>/dto"
    "<module>/internal/infrastructure/graphql/model"
    "<module>/internal/shared/middleware"
    domainErr "<module>/internal/shared/errors"
)

// Query
func (r *queryResolver) Get<Entity>(ctx context.Context, id string) (*model.<Entity>, error) {
    userID, err := middleware.UserIDFromContext(ctx)
    if err != nil {
        return nil, domainErr.ErrUnauthorized
    }

    resp, err := r.get<Entity>UseCase.Execute(ctx, &dto.Get<Entity>Request{
        ID:          id,
        RequesterID: userID,
    })
    if err != nil {
        return nil, err
    }
    return &model.<Entity>{
        ID:        resp.ID,
        CreatedAt: resp.CreatedAt,
        UpdatedAt: resp.UpdatedAt,
    }, nil
}

// Mutation
func (r *mutationResolver) Create<Entity>(ctx context.Context, input model.Create<Entity>Input) (*model.<Entity>Payload, error) {
    userID, err := middleware.UserIDFromContext(ctx)
    if err != nil {
        return nil, domainErr.ErrUnauthorized
    }

    resp, err := r.create<Entity>UseCase.Execute(ctx, &dto.Create<Entity>Request{
        RequesterID: userID,
        // map input fields
    })
    if err != nil {
        return nil, err
    }
    return &model.<Entity>Payload{
        <Entity>: &model.<Entity>{
            ID: resp.ID,
            // map response fields
        },
    }, nil
}
```

## Validation Rules
- Auth-protected resolvers must extract `userID` from context
- Mutations return `*model.XxxPayload`, not raw domain types
- Never return `PasswordHash` or internal fields
- Run `go generate` then `make generate-all` after every schema change
- Resolver receives use case **interface**, not concrete struct
