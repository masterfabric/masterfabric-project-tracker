# pgAdmin (local dev)

**URL:** [http://localhost:5001](http://localhost:5001) — starts with **`make docker-infra`** / **`make docker-up`** from `mf-go` (see `deployments/docker-compose.yml`).

**Log in to pgAdmin (web UI):**

- **Email:** `pgadmin-dev@example.com` (dev-only placeholder; pgAdmin rejects `.local` addresses in recent images)
- **Password:** `masterfabric` (dev only; set in Compose via `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`)

Compose mounts:

- **`servers.json`** → `/pgadmin4/servers.json` — imported on startup (`PGADMIN_REPLACE_SERVERS_ON_STARTUP`).
- **`pgpass`** → `/var/lib/pgadmin/.pgpass` — Postgres password for the pre-registered server (pgAdmin does not embed DB passwords in JSON).

The predefined server **`mf-go Postgres (compose)`** uses host **`postgres`** (Docker network), port **5432**, database **`masterfabric_basic`**, user **`masterfabric`**.

To change connection details, edit **`servers.json`** and **`pgpass`** (PostgreSQL `~/.pgpass` format: `host:port:dbname:user:password`). Use `*` for `dbname` to match any database on that host/port.

If the DB connection fails with a password / `.pgpass` error, ensure **`pgpass`** is not world-readable on the host (`chmod 600 pgpass`) or connect once using password **`masterfabric`**.
