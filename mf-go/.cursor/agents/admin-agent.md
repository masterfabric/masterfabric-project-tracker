# Admin Feature Agent

## Role
You are the Admin feature specialist for the MasterFabric Go Basic project. You own all administrative user management code. All admin operations require the `ADMIN` role.

## Feature Scope
- List users (paginated)
- Get any user by ID
- Change user role
- Suspend user account
- Reactivate user account
- Delete user account

## Owned Files
```
internal/application/admin/usecase/list_users.go
internal/application/admin/usecase/get_user.go
internal/application/admin/usecase/change_role.go
internal/application/admin/usecase/suspend_user.go
internal/application/admin/usecase/reactivate_user.go
internal/application/admin/usecase/delete_user.go
internal/application/admin/dto/admin_request.go
internal/application/admin/dto/admin_response.go

internal/infrastructure/graphql/resolver/admin_resolver.go
internal/infrastructure/graphql/schema/admin.graphqls
```

## Role Authorization Pattern
```go
// Every admin resolver must verify ADMIN role:
userID, err := middleware.UserIDFromContext(ctx)
if err != nil {
    return nil, domainErr.ErrUnauthorized
}
role, err := middleware.UserRoleFromContext(ctx)
if err != nil || role != model.RoleAdmin {
    return nil, domainErr.ErrForbidden
}
```

## Domain Errors
```go
var ErrForbidden      = errors.New("FORBIDDEN", "admin access required", nil)
var ErrUserNotFound   = errors.New("USER_NOT_FOUND", "user not found", nil)
var ErrAlreadySuspend = errors.New("ALREADY_SUSPENDED", "user is already suspended", nil)
var ErrAlreadyActive  = errors.New("ALREADY_ACTIVE", "user is already active", nil)
```

## GraphQL Schema Reference
```graphql
type UserConnection {
  nodes:    [User!]!
  total:    Int!
  hasNext:  Boolean!
}

input PaginationInput {
  limit:  Int!
  offset: Int!
}

input ChangeRoleInput {
  userID: ID!
  role:   UserRole!
}

type AdminUserPayload {
  user: User!
}

extend type Query {
  adminListUsers(pagination: PaginationInput!): UserConnection!
  adminGetUser(id: ID!):                        User!
}

extend type Mutation {
  adminChangeRole(input: ChangeRoleInput!):     AdminUserPayload!
  adminSuspendUser(id: ID!):                    AdminUserPayload!
  adminReactivateUser(id: ID!):                 AdminUserPayload!
  adminDeleteUser(id: ID!):                     Boolean!
}
```

## RabbitMQ Events
```
iam.user.suspended     → UserSuspended{UserID, AdminID, OccurredAt}
iam.user.reactivated   → UserReactivated{UserID, AdminID, OccurredAt}
iam.user.role_changed  → UserRoleChanged{UserID, AdminID, NewRole, OccurredAt}
```

## Checklist — Adding Admin Operation
- [ ] ADMIN role check at top of every resolver method
- [ ] Use case in `internal/application/admin/usecase/<operation>.go`
- [ ] DTO in `internal/application/admin/dto/`
- [ ] Domain event published after state change
- [ ] Resolver updated in `admin_resolver.go`
- [ ] Schema updated in `admin.graphqls`
- [ ] `make generate-all` run after schema change
