package main

import (
	"context"
	"log/slog"
	"strings"

	"github.com/99designs/gqlgen/graphql/handler/transport"
	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
)

// websocketInitWithAuth returns an InitFunc that validates the Bearer token from
// connection_init payload and injects userID/role into context for subscriptions.
func websocketInitWithAuth(jwtSvc *infraAuth.JWTService) transport.WebsocketInitFunc {
	return func(ctx context.Context, initPayload transport.InitPayload) (context.Context, *transport.InitPayload, error) {
		auth := initPayload.Authorization()
		if auth == "" {
			slog.Info("ws connection_init without auth")
			return ctx, nil, nil // proceed unauthenticated; resolvers will reject
		}
		parts := strings.SplitN(auth, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			slog.Info("ws connection_init invalid auth format")
			return ctx, nil, nil
		}
		token := parts[1]
		claims, err := jwtSvc.ValidateAccessToken(ctx, token)
		if err != nil {
			slog.Info("ws connection_init token rejected", slog.Any("error", err))
			return ctx, nil, nil
		}
		slog.Info("ws connection_init authenticated", slog.String("user_id", claims.UserID), slog.String("role", claims.Role))
		ctx = middleware.WithUserIDString(ctx, claims.UserID)
		ctx = middleware.WithUserRole(ctx, claims.Role)
		return ctx, nil, nil
	}
}
