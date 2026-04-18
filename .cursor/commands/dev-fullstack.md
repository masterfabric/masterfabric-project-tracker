# Full-Stack Dev — Start Both Projects

Run these in two terminals:

```bash
# Terminal 1: mf-go backend
cd mf-go && make docker-infra && make run

# Terminal 2: mf-expo app
cd mf-expo && npm install && npm start
```

Ensure `mf-expo/.env.development` has:
```
EXPO_PUBLIC_GRAPHQL_URL=http://localhost:8080/graphql
```
