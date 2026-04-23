package resolver

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	authUC "github.com/masterfabric/masterfabric_go_basic/internal/application/auth/usecase"
	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	"github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/graphql/model"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/config"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
)

func testLogoutResolver() *mutationResolver {
	jwtSvc := infraAuth.NewJWTService(
		config.JWTConfig{
			Secret:                  "test-secret-at-least-32-characters",
			AccessTokenTTL:          15 * time.Minute,
			RefreshTokenTTL:         7 * 24 * time.Hour,
			MaxRefreshTokensPerUser: 10,
		},
		infraRedis.NewCacheHandler(nil),
		nil,
	)
	return &mutationResolver{
		&Resolver{
			LogoutUC: authUC.NewLogoutUseCase(jwtSvc),
		},
	}
}

func TestLogoutRejectsUnauthenticatedCaller(t *testing.T) {
	r := testLogoutResolver()
	uid := uuid.New()

	ok, err := r.Logout(context.Background(), model.LogoutInput{
		UserID:       uid,
		AccessToken:  "access",
		RefreshToken: "refresh",
	})

	if ok {
		t.Fatalf("expected ok=false for unauthenticated caller")
	}
	if !domainErr.IsCode(err, domainErr.ErrUnauthorized.Code) {
		t.Fatalf("expected %s, got: %v", domainErr.ErrUnauthorized.Code, err)
	}
}

func TestLogoutRejectsMismatchedCallerAndInputUserID(t *testing.T) {
	r := testLogoutResolver()
	callerID := uuid.New()
	targetID := uuid.New()
	ctx := middleware.WithUserID(context.Background(), callerID)

	ok, err := r.Logout(ctx, model.LogoutInput{
		UserID:       targetID,
		AccessToken:  "access",
		RefreshToken: "refresh",
	})

	if ok {
		t.Fatalf("expected ok=false for mismatched caller/input userID")
	}
	if !domainErr.IsCode(err, domainErr.ErrForbidden.Code) {
		t.Fatalf("expected %s, got: %v", domainErr.ErrForbidden.Code, err)
	}
}

func TestLogoutAllowsMatchingAuthenticatedCaller(t *testing.T) {
	r := testLogoutResolver()
	userID := uuid.New()
	ctx := middleware.WithUserID(context.Background(), userID)

	ok, err := r.Logout(ctx, model.LogoutInput{
		UserID:       userID,
		AccessToken:  "access",
		RefreshToken: "refresh",
	})

	if err != nil {
		t.Fatalf("expected nil error, got: %v", err)
	}
	if !ok {
		t.Fatalf("expected ok=true for matching authenticated caller")
	}
}
