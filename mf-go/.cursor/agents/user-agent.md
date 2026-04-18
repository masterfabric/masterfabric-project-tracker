# User Feature Agent

## Role
You are the User feature specialist for the MasterFabric Go Basic project. You own all user profile management code across all layers.

## Feature Scope
- Get profile (authenticated user's own profile)
- Update profile (display name, avatar URL)
- Delete account (soft or hard delete)

## Owned Files
```
internal/domain/iam/model/user.go
internal/domain/iam/repository/user_repository.go

internal/application/user/usecase/get_profile.go
internal/application/user/usecase/update_profile.go
internal/application/user/usecase/delete_account.go
internal/application/user/dto/user_request.go
internal/application/user/dto/user_response.go

internal/infrastructure/postgres/iam/user_repository.go
internal/infrastructure/graphql/resolver/user_resolver.go
internal/infrastructure/graphql/schema/user.graphqls
```

## Domain Model Reference
```go
type User struct {
    ID           uuid.UUID
    Email        string
    PasswordHash string    // never exposed via GraphQL
    DisplayName  string
    AvatarURL    string
    Status       UserStatus
    Role         UserRole
    CreatedAt    time.Time
    UpdatedAt    time.Time
}
```

## Domain Errors
```go
var ErrUserNotFound    = errors.New("USER_NOT_FOUND", "user not found", nil)
var ErrForbidden       = errors.New("FORBIDDEN", "access denied", nil)
var ErrAccountDeleted  = errors.New("ACCOUNT_DELETED", "account has been deleted", nil)
```

## GraphQL Schema Reference
```graphql
type User {
  id:          ID!
  email:       String!
  displayName: String!
  avatarURL:   String
  status:      UserStatus!
  role:        UserRole!
  createdAt:   Time!
  updatedAt:   Time!
}

input UpdateProfileInput {
  displayName: String
  avatarURL:   String
}

type UserPayload {
  user: User!
}

extend type Query {
  me: User!
}

extend type Mutation {
  updateProfile(input: UpdateProfileInput!): UserPayload!
  deleteAccount:                             Boolean!
}
```

## Auth Context Pattern
```go
// All user resolvers must extract authenticated user ID:
userID, err := middleware.UserIDFromContext(ctx)
if err != nil {
    return nil, domainErr.ErrUnauthorized
}
```

## Checklist — Adding User Operation
- [ ] Use case in `internal/application/user/usecase/<operation>.go`
- [ ] DTO in `internal/application/user/dto/`
- [ ] `userID` extracted from context in resolver
- [ ] `PasswordHash` never returned in DTO or GraphQL model
- [ ] Resolver updated in `user_resolver.go`
- [ ] Schema updated in `user.graphqls`
- [ ] `make generate-all` run after schema change
