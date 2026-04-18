package health

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/masterfabric/masterfabric_go_basic/internal/shared/version"
)

// Status represents the health state of a single dependency.
type Status string

const (
	StatusOK   Status = "ok"
	StatusFail Status = "fail"
)

// Readiness probe: allow several quick pings so a single stale TCP conn or
// sub-second blip does not flip the whole app to 503 (orchestrators often use this).
const (
	readinessTimeout  = 6 * time.Second
	healthPingRetries = 4
	healthPingPause   = 80 * time.Millisecond
)

// Check holds the result for one dependency.
type Check struct {
	Status  Status `json:"status"`
	Message string `json:"message,omitempty"`
}

// Response is the full health payload.
type Response struct {
	Status      Status            `json:"status"`
	ServiceName string            `json:"serviceName"`
	Version     string            `json:"version"`
	Checks      map[string]*Check `json:"checks"`
}

// Handler returns an http.HandlerFunc that pings all registered dependencies.
func Handler(pool *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), readinessTimeout)
		defer cancel()

		checks := map[string]*Check{
			"postgres": checkPostgres(ctx, pool),
			"redis":    checkRedis(ctx, rdb),
		}

		// Overall status: fail if any dependency fails.
		overall := StatusOK
		for _, c := range checks {
			if c.Status == StatusFail {
				overall = StatusFail
				break
			}
		}

		resp := Response{
			Status:      overall,
			ServiceName: version.ServiceName,
			Version:     version.Version,
			Checks:      checks,
		}

		w.Header().Set("Content-Type", "application/json")
		if overall == StatusFail {
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			w.WriteHeader(http.StatusOK)
		}
		_ = json.NewEncoder(w).Encode(resp)
	}
}

func checkPostgres(ctx context.Context, pool *pgxpool.Pool) *Check {
	if pool == nil {
		return &Check{Status: StatusFail, Message: "not configured"}
	}
	for attempt := 0; attempt < healthPingRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return &Check{Status: StatusFail, Message: "postgres unavailable"}
			case <-time.After(healthPingPause):
			}
		}
		if err := pool.Ping(ctx); err == nil {
			return &Check{Status: StatusOK}
		}
	}
	return &Check{Status: StatusFail, Message: "postgres unavailable"}
}

func checkRedis(ctx context.Context, rdb *redis.Client) *Check {
	if rdb == nil {
		return &Check{Status: StatusFail, Message: "not configured"}
	}
	for attempt := 0; attempt < healthPingRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return &Check{Status: StatusFail, Message: "redis unavailable"}
			case <-time.After(healthPingPause):
			}
		}
		if err := rdb.Ping(ctx).Err(); err == nil {
			return &Check{Status: StatusOK}
		}
	}
	return &Check{Status: StatusFail, Message: "redis unavailable"}
}
