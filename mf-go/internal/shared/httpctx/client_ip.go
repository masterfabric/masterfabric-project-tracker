package httpctx

import (
	"context"
	"net/http"
)

type ctxKey int

const clientIPKey ctxKey = 1

// WithClientIP attaches the client IP (or forwarded address) to the context.
func WithClientIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, clientIPKey, ip)
}

// ClientIP returns the client IP from context, or empty if unset.
func ClientIP(ctx context.Context) string {
	v, _ := ctx.Value(clientIPKey).(string)
	return v
}

// Middleware stores r.RemoteAddr (after chi RealIP) in the request context.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := WithClientIP(r.Context(), r.RemoteAddr)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
