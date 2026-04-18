# Create Service

Create a new service in `mf-expo/src/shared/services/` following the project's service pattern.

## Location

```
mf-expo/src/shared/services/
├── <service-name>.ts      # New service
└── index.ts               # Add export here
```

## Conventions

- **Naming**: Use kebab-case for file (e.g. `toast-service.ts`), PascalCase for class (e.g. `ToastService`)
- **Singleton**: Use `getInstance()` for services that need global state
- **Export**: Export both the singleton instance and the class from the service file
- **Index**: Add `export { ... } from './<service-name>'` to `shared/services/index.ts`

## Service Pattern (Singleton)

```typescript
// <service-name>.ts
class <ServiceName>Service {
  private static instance: <ServiceName>Service;

  static getInstance(): <ServiceName>Service {
    if (!<ServiceName>Service.instance) {
      <ServiceName>Service.instance = new <ServiceName>Service();
    }
    return <ServiceName>Service.instance;
  }

  // Methods...
}

const instance = <ServiceName>Service.getInstance();
export const <serviceName>Service = instance;
export { <ServiceName>Service };
```

## Core Package Integration (Optional)

If the service implements a core package interface (e.g. `LoggerServiceInterface`, `ToastServiceInterface`):

```typescript
import { setLoggerService } from 'masterfabric-expo-core';
// After creating instance:
setLoggerService(instance);
```

## Usage in Views

```typescript
import { <serviceName>Service } from '@/src/shared/services';
// or
import { <serviceName>Service } from '@/src/shared/services/<service-name>';
```
