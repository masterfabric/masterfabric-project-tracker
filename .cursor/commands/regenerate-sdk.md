# Regenerate platform SDKs (core-base)

This repo has **no** in-tree `mf-go`. After changing GraphQL schema in **masterfabric-core-base**:

```bash
cd ../masterfabric-core-base/mf-go && make generate-all
```

Never edit generated SDKs by hand. Then update this client’s GraphQL usage (`mf-go-api.ts`, Particular envelope helpers) to match.

For **particular-project-tracker** schema changes, work in **masterfabric-particulars** and keep the Particular hop (`particularGraphqlEnvelope`) contract in sync.
