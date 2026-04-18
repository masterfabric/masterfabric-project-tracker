package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/admin/dto"
)

// MyAccountDeletionImpactReader loads DB counts for the self-service deletion preview.
type MyAccountDeletionImpactReader interface {
	FetchCounts(ctx context.Context, userID uuid.UUID) (*dto.UserDeletionImpactResponse, error)
}

// GetMyAccountDeletionImpactUseCase returns cascade impact for the authenticated user only.
type GetMyAccountDeletionImpactUseCase struct {
	impactRepo MyAccountDeletionImpactReader
}

// NewGetMyAccountDeletionImpactUseCase constructs GetMyAccountDeletionImpactUseCase.
func NewGetMyAccountDeletionImpactUseCase(impactRepo MyAccountDeletionImpactReader) *GetMyAccountDeletionImpactUseCase {
	return &GetMyAccountDeletionImpactUseCase{impactRepo: impactRepo}
}

// Execute loads relational counts for userID (caller must ensure this is the authenticated user).
func (uc *GetMyAccountDeletionImpactUseCase) Execute(ctx context.Context, userID uuid.UUID) (*dto.UserDeletionImpactResponse, error) {
	resp, err := uc.impactRepo.FetchCounts(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("myAccountDeletionImpact: %w", err)
	}
	if resp == nil {
		return nil, fmt.Errorf("myAccountDeletionImpact: empty response")
	}
	return resp, nil
}
