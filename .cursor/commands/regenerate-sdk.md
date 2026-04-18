# Regenerate mf-go SDKs

After changing any `.graphqls` file in `mf-go/internal/infrastructure/graphql/schema/`:

```bash
cd mf-go && make generate-all
```

This regenerates `sdk/dart_go_api/` and `sdk/swift_go_api/`. Never edit these by hand.
