# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# Cache dependency downloads separately from source changes
COPY go.mod go.sum ./
RUN GOTOOLCHAIN=local go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GOTOOLCHAIN=local \
    go build -trimpath -ldflags="-s -w" \
    -o /app/bin/server ./cmd/server

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM scratch

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /app/bin/server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
