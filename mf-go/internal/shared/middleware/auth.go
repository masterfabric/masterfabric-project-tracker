package middleware

import (
	"net/http"
	"strings"

	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
)

// AuthMiddleware extracts the Bearer token from the Authorization header,
// validates it with JWTService, and injects the user ID into the request context.
// Requests without a valid token proceed (resolvers enforce auth individually).
func AuthMiddleware(jwtSvc *infraAuth.JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				next.ServeHTTP(w, r)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				next.ServeHTTP(w, r)
				return
			}

			token := parts[1]
			claims, err := jwtSvc.ValidateAccessToken(r.Context(), token)
			if err != nil {
				// Invalid / expired token — continue unauthenticated; resolvers will reject
				next.ServeHTTP(w, r)
				return
			}

			ctx := WithUserIDString(r.Context(), claims.UserID)
			ctx = WithUserRole(ctx, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
