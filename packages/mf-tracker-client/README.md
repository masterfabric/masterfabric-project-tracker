# mf-tracker-client

Shared GraphQL client for Project Tracker web and desktop clients.

Talks to **mf-go** (auth, orgs, personal todos, chat) and hops org projects/todos/purchases via `particularGraphqlEnvelope` → Particular key `project_tracker`.

## Setup

```ts
import {
  configureTrackerClient,
  api,
  type SessionStorage,
} from "mf-tracker-client";

const sessionStorage: SessionStorage = { /* get/set/clear tokens */ };

configureTrackerClient({
  sessionStorage,
  config: {
    graphqlUrl: "http://127.0.0.1:8080/graphql",
    bundleId: "com.masterfabric.monoExpo",
    platform: "web",
    deviceName: "mf-web",
  },
});

await api.login(email, password);
```

Call `configureTrackerClient` once at app boot before any GraphQL call.
