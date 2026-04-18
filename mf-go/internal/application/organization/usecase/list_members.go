package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	userUC "github.com/masterfabric/masterfabric_go_basic/internal/application/user/usecase"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

// ListOrganizationMembersUseCase returns all members of an organization.
type ListOrganizationMembersUseCase struct {
	repo         orgRepo.OrganizationRepository
	getProfileUC *userUC.GetProfileUseCase
}

// NewListOrganizationMembersUseCase constructs a ListOrganizationMembersUseCase.
func NewListOrganizationMembersUseCase(repo orgRepo.OrganizationRepository, getProfileUC *userUC.GetProfileUseCase) *ListOrganizationMembersUseCase {
	return &ListOrganizationMembersUseCase{repo: repo, getProfileUC: getProfileUC}
}

// Execute returns all members for the given organization ID (caller must be a member).
func (uc *ListOrganizationMembersUseCase) Execute(ctx context.Context, orgID, callerUserID uuid.UUID) ([]*dto.OrganizationMemberResponse, error) {
	ok, err := uc.repo.IsMember(ctx, orgID, callerUserID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationMembers: %w", err)
	}
	if !ok {
		return nil, fmt.Errorf("listOrganizationMembers: user is not a member of organization")
	}

	members, err := uc.repo.ListMembers(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationMembers: %w", err)
	}

	result := make([]*dto.OrganizationMemberResponse, 0, len(members))
	for _, m := range members {
		nickname := ""
		if profile, err := uc.getProfileUC.Execute(ctx, m.UserID.String()); err == nil && profile != nil && profile.Nickname != "" {
			nickname = profile.Nickname
		}
		ms := string(m.MembershipStatus)
		if ms == "" {
			ms = string(model.OrganizationMembershipActive)
		}
		result = append(result, &dto.OrganizationMemberResponse{
			ID:               m.ID.String(),
			OrganizationID:   m.OrganizationID.String(),
			UserID:           m.UserID.String(),
			UserNickname:     nickname,
			Role:             string(m.Role),
			MembershipStatus: ms,
			JoinedAt:         m.JoinedAt.Format(time.RFC3339),
		})
	}

	return result, nil
}
