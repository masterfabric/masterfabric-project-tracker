# Full-stack local dev (multi-repo)

This repo starts **clients only**. Backend runs in sibling repos.

```bash
# Terminal 1 — platform GraphQL (masterfabric-core-base)
cd ../masterfabric-core-base/mf-go && make docker-infra && make run

# Terminal 2 — particular-project-tracker (masterfabric-particulars)
cd ../masterfabric-particulars && ./scripts/setup-project-tracker.sh --start

# Terminal 3 — mf-expo (this repo)
cd mf-expo && npm install && npm start
# or from repo root: npm run start-all
```

Ensure root `local.env` (or `mf-expo/.env.development`) has:

```
EXPO_PUBLIC_DEV_GRAPHQL_URL=http://localhost:8080/graphql
EXPO_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR=project_tracker
```
