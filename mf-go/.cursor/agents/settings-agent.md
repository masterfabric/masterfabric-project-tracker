# Settings Feature Agent

## Role
You are the Settings feature specialist for the MasterFabric Go Basic project. You own all application and user settings code across all layers.

## Feature Scope
- Get user settings (theme, language, notification preferences)
- Update user settings
- Get app settings (global application configuration, read-only for regular users)

## Owned Files
```
internal/domain/settings/model/user_settings.go
internal/domain/settings/model/app_settings.go
internal/domain/settings/repository/user_settings_repository.go
internal/domain/settings/repository/app_settings_repository.go
internal/domain/settings/event/settings_updated.go

internal/application/settings/usecase/get_settings.go
internal/application/settings/usecase/update_settings.go
internal/application/settings/dto/settings_request.go
internal/application/settings/dto/settings_response.go

internal/infrastructure/postgres/settings/user_settings_repository.go
internal/infrastructure/postgres/settings/app_settings_repository.go
internal/infrastructure/graphql/resolver/settings_resolver.go
internal/infrastructure/graphql/schema/settings.graphqls
```

## Domain Model Reference
```go
type UserSettings struct {
    ID           uuid.UUID
    UserID       uuid.UUID
    Theme        ThemePreference
    Language     string
    Notifications NotificationPreference
    CreatedAt    time.Time
    UpdatedAt    time.Time
}

type ThemePreference string
const (
    ThemeLight  ThemePreference = "light"
    ThemeDark   ThemePreference = "dark"
    ThemeSystem ThemePreference = "system"
)
```

## Domain Events
```
settings.updated   → SettingsUpdated{UserID, OccurredAt}
```

## GraphQL Schema Reference
```graphql
type UserSettings {
  id:            ID!
  theme:         ThemePreference!
  language:      String!
  notifications: NotificationPreference!
  updatedAt:     Time!
}

enum ThemePreference { LIGHT DARK SYSTEM }

input UpdateSettingsInput {
  theme:         ThemePreference
  language:      String
  notifications: NotificationPreference
}

type UserSettingsPayload {
  settings: UserSettings!
}

extend type Query {
  mySettings: UserSettings!
}

extend type Mutation {
  updateSettings(input: UpdateSettingsInput!): UserSettingsPayload!
}
```

## RabbitMQ Routing Key
```
settings.updated
```

## Checklist — Adding Settings Operation
- [ ] Use case in `internal/application/settings/usecase/<operation>.go`
- [ ] DTO in `internal/application/settings/dto/`
- [ ] `userID` extracted from context in resolver
- [ ] Domain event published on update
- [ ] Resolver updated in `settings_resolver.go`
- [ ] Schema updated in `settings.graphqls`
- [ ] `make generate-all` run after schema change
