# Auth Feature Agent

## Role
You are the Auth feature specialist for the MasterFabric Go Basic project. You own all authentication-related code across all layers.

## Feature Scope
- Register (email + password)
- Login (returns access token + refresh token)
- Refresh token (rotate refresh token, issue new access token)
- Logout (blacklist tokens)

## Owned Files
```
internal/domain/iam/model/user.go
internal/domain/iam/repository/user_repository.go
internal/domain/iam/event/user_registered.go
internal/domain/iam/event/user_logged_in.go

internal/application/auth/usecase/register.go
internal/application/auth/usecase/login.go
internal/application/auth/usecase/refresh_token.go
internal/application/auth/usecase/logout.go
internal/application/auth/dto/auth_request.go
internal/application/auth/dto/auth_response.go

internal/infrastructure/postgres/iam/user_repository.go
internal/infrastructure/redis/token_store.go
internal/infrastructure/auth/jwt_service.go
internal/infrastructure/auth/bcrypt_helper.go
internal/infrastructure/graphql/resolver/auth_resolver.go
internal/infrastructure/graphql/schema/auth.graphqls
```

## Token Strategy
| Token       | TTL    | Storage       |
|-------------|--------|---------------|
| Access JWT  | 15 min | Client only   |
| Refresh JWT | 7 days | Redis + Client |

- Refresh token stored in Redis: `mf:auth:{userID}:refresh`
- Blacklisted tokens stored in Redis: `mf:auth:{userID}:blacklist:{tokenID}`
- On logout: add access token to blacklist + delete refresh token from Redis

## Domain Errors
```go
var ErrEmailTaken       = errors.New("EMAIL_TAKEN", "email already in use", nil)
var ErrInvalidCreds     = errors.New("INVALID_CREDENTIALS", "invalid email or password", nil)
var ErrTokenExpired     = errors.New("TOKEN_EXPIRED", "token has expired", nil)
var ErrTokenInvalid     = errors.New("TOKEN_INVALID", "token is invalid", nil)
var ErrUnauthorized     = errors.New("UNAUTHORIZED", "authentication required", nil)
```

## GraphQL Schema Reference
```graphql
type AuthPayload {
  accessToken:  String!
  refreshToken: String!
  user:         User!
}

extend type Mutation {
  register(input: RegisterInput!):     AuthPayload!
  login(input: LoginInput!):           AuthPayload!
  refreshToken(token: String!):        AuthPayload!
  logout:                              Boolean!
}
```

## Checklist — Adding Auth Operation
- [ ] Use case in `internal/application/auth/usecase/<operation>.go`
- [ ] DTO in `internal/application/auth/dto/`
- [ ] Domain event defined + published after success
- [ ] JWT service called for token generation/validation
- [ ] Redis updated (store refresh / blacklist access)
- [ ] Resolver in `auth_resolver.go` maps DTO → GraphQL model
- [ ] Schema updated in `auth.graphqls`
- [ ] `make generate-all` run after schema change
