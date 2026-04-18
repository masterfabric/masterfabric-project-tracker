package usecase

import (
	"context"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	infraAuth "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/auth"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// passwordHistoryDepth is how many previously used passwords cannot be chosen again.
const passwordHistoryDepth = 3

func rejectIfPasswordReusesRecent(
	ctx context.Context,
	newPlain string,
	userID uuid.UUID,
	currentBcryptHash string,
	hist repository.PasswordHistoryRepository,
) error {
	if newPlain == "" {
		return nil
	}
	// Same as current password (already verified current for change-password; still enforce for reset).
	if err := infraAuth.CheckPassword(newPlain, currentBcryptHash); err == nil {
		return domainErr.ErrPasswordReuseNotAllowed
	}
	hashes, err := hist.ListRecentHashes(ctx, userID, passwordHistoryDepth)
	if err != nil {
		return err
	}
	for _, h := range hashes {
		if err := infraAuth.CheckPassword(newPlain, h); err == nil {
			return domainErr.ErrPasswordReuseNotAllowed
		}
	}
	return nil
}
