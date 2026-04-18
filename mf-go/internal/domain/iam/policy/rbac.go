package policy

import (
	"context"

	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/model"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
	"github.com/masterfabric/masterfabric_go_basic/internal/shared/middleware"
)

// roleRank maps each role to a numeric rank for hierarchical comparisons.
// Higher number = higher privilege.
var roleRank = map[model.UserRole]int{
	model.UserRoleUser:      1,
	model.UserRoleModerator: 2,
	model.UserRoleAdmin:     3,
}

// HasRole reports whether role has at least the privilege level of required.
func HasRole(role model.UserRole, required model.UserRole) bool {
	return roleRank[role] >= roleRank[required]
}

// RequireRole enforces that the caller has at least the given role.
// It reads the role from the request context (set by AuthMiddleware).
// Returns ErrForbidden if the role requirement is not met.
func RequireRole(ctx context.Context, required model.UserRole) error {
	roleStr := middleware.UserRoleFromContext(ctx)
	if roleStr == "" {
		return domainErr.ErrUnauthorized
	}
	if !HasRole(model.UserRole(roleStr), required) {
		return domainErr.ErrForbidden
	}
	return nil
}

// RequireAdmin is a convenience wrapper for RequireRole(ctx, UserRoleAdmin).
func RequireAdmin(ctx context.Context) error {
	return RequireRole(ctx, model.UserRoleAdmin)
}

// RequireModerator is a convenience wrapper for RequireRole(ctx, UserRoleModerator).
// Admins also pass this check (hierarchical).
func RequireModerator(ctx context.Context) error {
	return RequireRole(ctx, model.UserRoleModerator)
}
