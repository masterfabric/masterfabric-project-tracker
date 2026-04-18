package redis

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// CacheHandler is the base cache service. It wraps a *redis.Client and exposes
// typed, nil-safe methods that all infrastructure services can use uniformly.
// When the underlying client is nil (Redis unavailable) every operation is a
// no-op / returns a sentinel "miss" so callers degrade gracefully.
type CacheHandler struct {
	client *redis.Client
}

// NewCacheHandler creates a CacheHandler. client may be nil; all methods are
// safe to call in that case and will behave as cache misses / no-ops.
func NewCacheHandler(client *redis.Client) *CacheHandler {
	return &CacheHandler{client: client}
}

// Available reports whether the underlying Redis client is connected.
func (h *CacheHandler) Available() bool {
	return h.client != nil
}

// Set stores value at key with the given TTL. A zero TTL means no expiry.
func (h *CacheHandler) Set(ctx context.Context, key, value string, ttl time.Duration) error {
	if h.client == nil {
		return nil
	}
	return h.client.Set(ctx, key, value, ttl).Err()
}

// atomicGetDelScript GETs and DELs a key in one round trip. Redis GETDEL (6.2+) is
// unavailable on Azure Cache for Redis 6.0; Lua is supported. redis.NewScript uses
// EVALSHA after the first load so the script body is not resent every call.
var atomicGetDelScript = redis.NewScript(`
local v = redis.call('GET', KEYS[1])
if v == false then
	return nil
end
redis.call('DEL', KEYS[1])
return v
`)

// GetDel atomically returns the string value at key and deletes the key.
// Returns ("", false, nil) when the key does not exist.
func (h *CacheHandler) GetDel(ctx context.Context, key string) (string, bool, error) {
	if h.client == nil {
		return "", false, nil
	}
	val, err := atomicGetDelScript.Run(ctx, h.client, []string{key}).Result()
	if err == redis.Nil || val == nil {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	s, ok := val.(string)
	if !ok {
		return "", false, fmt.Errorf("redis getdel %q: unexpected value type %T", key, val)
	}
	return s, true, nil
}

// Get retrieves the string value at key.
// Returns ("", false, nil) when the key does not exist.
// Returns ("", false, err) on a real Redis error.
func (h *CacheHandler) Get(ctx context.Context, key string) (string, bool, error) {
	if h.client == nil {
		return "", false, nil
	}
	val, err := h.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return val, true, nil
}

// GetInt64 parses the decimal integer at key. Returns (0, false, nil) on cache miss; (0, false, err) on Redis error.
func (h *CacheHandler) GetInt64(ctx context.Context, key string) (int64, bool, error) {
	if h.client == nil {
		return 0, false, nil
	}
	val, err := h.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	n, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return 0, true, fmt.Errorf("redis key %s: parse int: %w", key, err)
	}
	return n, true, nil
}

// Del removes one or more keys. It is a no-op when Redis is unavailable.
func (h *CacheHandler) Del(ctx context.Context, keys ...string) error {
	if h.client == nil {
		return nil
	}
	return h.client.Del(ctx, keys...).Err()
}

// IncrWithExpiry increments key by 1. If the key is new (value becomes 1), sets TTL.
func (h *CacheHandler) IncrWithExpiry(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	if h.client == nil {
		return 0, nil
	}
	n, err := h.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, err
	}
	if n == 1 && ttl > 0 {
		_ = h.client.Expire(ctx, key, ttl).Err()
	}
	return n, nil
}

// Exists returns true if all of the given keys exist in Redis.
func (h *CacheHandler) Exists(ctx context.Context, keys ...string) (bool, error) {
	if h.client == nil {
		return false, nil
	}
	n, err := h.client.Exists(ctx, keys...).Result()
	if err != nil {
		return false, err
	}
	return n == int64(len(keys)), nil
}

// SetNX sets key to value only if it does not already exist.
// Returns true if the key was set, false if it already existed.
func (h *CacheHandler) SetNX(ctx context.Context, key, value string, ttl time.Duration) (bool, error) {
	if h.client == nil {
		return false, nil
	}
	return h.client.SetNX(ctx, key, value, ttl).Result()
}

// Expire updates the TTL on an existing key. Returns false if the key does not
// exist; true if the TTL was set successfully.
func (h *CacheHandler) Expire(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	if h.client == nil {
		return false, nil
	}
	return h.client.Expire(ctx, key, ttl).Result()
}

// TTL returns the remaining time-to-live for key.
// Returns -2 if the key does not exist, -1 if it has no expiry.
func (h *CacheHandler) TTL(ctx context.Context, key string) (time.Duration, error) {
	if h.client == nil {
		return -2, nil
	}
	return h.client.TTL(ctx, key).Result()
}

// ListKeysMatch returns all keys matching pattern (Redis SCAN). Safe when client is nil.
func (h *CacheHandler) ListKeysMatch(ctx context.Context, pattern string) ([]string, error) {
	if h.client == nil {
		return nil, nil
	}
	var out []string
	var cursor uint64
	const batch = 256
	for {
		keys, next, err := h.client.Scan(ctx, cursor, pattern, batch).Result()
		if err != nil {
			return nil, err
		}
		out = append(out, keys...)
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return out, nil
}

// DeleteKeysMatch removes all keys matching pattern (Redis SCAN). Safe when client is nil.
func (h *CacheHandler) DeleteKeysMatch(ctx context.Context, pattern string) error {
	if h.client == nil {
		return nil
	}
	keys, err := h.ListKeysMatch(ctx, pattern)
	if err != nil {
		return err
	}
	if len(keys) > 0 {
		return h.client.Del(ctx, keys...).Err()
	}
	return nil
}
