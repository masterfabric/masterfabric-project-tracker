# Create View (Screen)

Create a new screen in `mf-expo/src/screens/<feature-name>/` following the project's view pattern.

## Structure

```
mf-expo/src/screens/<feature-name>/
├── components/
│   ├── <feature-name>-screen.tsx    # Main screen component
│   └── index.ts
├── hooks/
│   ├── use-<feature-name>-view-model.ts
│   └── index.ts
├── store/
│   ├── <feature-name>-store.ts      # Zustand store (if needed)
│   └── index.ts
├── models/
│   ├── <feature-name>-models.ts     # Types/interfaces (if needed)
│   └── index.ts
├── utils/
│   └── index.ts
├── styles/
│   └── <feature-name>-screen.styles.ts
├── constants/
│   └── index.ts
└── index.ts                         # Public exports
```

## Conventions

- **Naming**: Use kebab-case for folder and file names (e.g. `toast-helper`, `use-toast-helper-view-model.ts`)
- **View model**: `use<FeatureName>ViewModel` hook — holds business logic, calls services, manages loading/error state
- **Screen component**: Receives view model via hook, renders UI only
- **Store**: Use Zustand when screen has local state beyond what the view model needs
- **Exports**: Re-export from `index.ts` — screen component, view model hook, models, store

## View Model Pattern

```typescript
// hooks/use-<feature>-view-model.ts
export function use<FeatureName>ViewModel() {
  const { state, setState } = useFeatureStore();
  // Use services from @/src/shared/services
  // Return: { ...state, handlers }
  return {
    isLoading,
    data,
    handleAction,
    navigateBack,
  };
}
```

## Screen Component Pattern

```tsx
// components/<feature-name>-screen.tsx
export function <FeatureName>Screen() {
  const vm = use<FeatureName>ViewModel();
  return (
    <View>
      {/* Use vm.* for state and handlers */}
    </View>
  );
}
```

## App Route

Add route in `mf-expo/app/` (e.g. `app/<feature-name>.tsx` or under tabs) and wire navigation.
