package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	"github.com/redis/go-redis/v9"
)

// applyManagedRedisDefaults tunes the go-redis pool for cloud Redis (e.g. Azure Cache).
// Idle TCP connections are often closed server-side; recycling pool conns and retries
// avoids spurious EOF / i/o timeout on the next command after quiet periods.
func applyManagedRedisDefaults(opts *redis.Options) {
	if opts.DialTimeout <= 0 {
		opts.DialTimeout = 5 * time.Second
	}
	if opts.ReadTimeout <= 0 {
		opts.ReadTimeout = 5 * time.Second
	}
	if opts.WriteTimeout <= 0 {
		opts.WriteTimeout = 5 * time.Second
	}
	if opts.MaxRetries == 0 {
		opts.MaxRetries = 3
	}
	if opts.MinIdleConns <= 0 {
		opts.MinIdleConns = 1
	}
	// go-redis default ConnMaxIdleTime is 30m; many managed tiers drop silent conns earlier.
	opts.ConnMaxIdleTime = 3 * time.Minute
}

// NewRedisClient creates and pings a Redis client.
// If cfg.URL is set (e.g. a Render-provided redis://... connection string) it
// takes precedence over cfg.Addr, cfg.Password, and cfg.DB.
func NewRedisClient(ctx context.Context, cfg config.RedisConfig) (*redis.Client, error) {
	var opts *redis.Options

	if cfg.URL != "" {
		parsed, err := redis.ParseURL(cfg.URL)
		if err != nil {
			return nil, fmt.Errorf("parse redis url: %w", err)
		}
		opts = parsed
	} else {
		opts = &redis.Options{
			Addr:     cfg.Addr,
			Password: cfg.Password,
			DB:       cfg.DB,
		}
	}

	applyManagedRedisDefaults(opts)

	client := redis.NewClient(opts)

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return client, nil
}
