package middleware

import (
	"context"
	"net/http"

	"github.com/google/uuid"
)

type contextKey string

const (
	contextKeyUserID    contextKey = "user_id"
	contextKeyUserRole  contextKey = "user_role"
	contextKeyRequestID contextKey = "request_id"
)

// WithUserID stores a user ID in the context.
func WithUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, contextKeyUserID, userID)
}

// UserIDFromContext extracts the user ID from context.
// Returns uuid.Nil if not present.
func UserIDFromContext(ctx context.Context) uuid.UUID {
	if id, ok := ctx.Value(contextKeyUserID).(uuid.UUID); ok {
		return id
	}
	return uuid.Nil
}

// WithUserRole stores the user's role string in the context.
func WithUserRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, contextKeyUserRole, role)
}

// UserRoleFromContext extracts the user's role from context.
// Returns empty string if not authenticated.
func UserRoleFromContext(ctx context.Context) string {
	if role, ok := ctx.Value(contextKeyUserRole).(string); ok {
		return role
	}
	return ""
}

// WithRequestID stores a request ID in the context.
func WithRequestID(ctx context.Context, reqID string) context.Context {
	return context.WithValue(ctx, contextKeyRequestID, reqID)
}

// RequestIDFromContext extracts the request ID from context.
func RequestIDFromContext(ctx context.Context) string {
	if id, ok := ctx.Value(contextKeyRequestID).(string); ok {
		return id
	}
	return ""
}

// WithUserIDString parses the string UUID and stores it in the context.
// If parsing fails the context is returned unchanged.
func WithUserIDString(ctx context.Context, userIDStr string) context.Context {
	id, err := uuid.Parse(userIDStr)
	if err != nil {
		return ctx
	}
	return WithUserID(ctx, id)
}

// RequestIDMiddleware injects a unique request ID into every request context.
func RequestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get("X-Request-ID")
		if reqID == "" {
			reqID = uuid.New().String()
		}
		ctx := WithRequestID(r.Context(), reqID)
		w.Header().Set("X-Request-ID", reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
