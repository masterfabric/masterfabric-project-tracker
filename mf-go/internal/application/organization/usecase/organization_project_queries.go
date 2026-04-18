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

// ListOrganizationProjectsUseCase lists projects in an organization (any active org member).
type ListOrganizationProjectsUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewListOrganizationProjectsUseCase constructs the use case.
func NewListOrganizationProjectsUseCase(repo orgRepo.OrganizationRepository) *ListOrganizationProjectsUseCase {
	return &ListOrganizationProjectsUseCase{repo: repo}
}

// Execute returns projects for the organization.
func (uc *ListOrganizationProjectsUseCase) Execute(ctx context.Context, orgID, callerUserID uuid.UUID) ([]*dto.OrganizationProjectResponse, error) {
	if err := ensureOrgMember(ctx, uc.repo, orgID, callerUserID); err != nil {
		return nil, err
	}
	var rows []*model.OrganizationProject
	var err error
	admin, aerr := uc.repo.IsAdminOrOwner(ctx, orgID, callerUserID)
	if aerr != nil {
		return nil, fmt.Errorf("listOrganizationProjects: %w", aerr)
	}
	if admin {
		rows, err = uc.repo.ListOrganizationProjectsByOrgID(ctx, orgID)
	} else {
		rows, err = uc.repo.ListOrganizationProjectsForOrgMember(ctx, orgID, callerUserID)
	}
	if err != nil {
		return nil, fmt.Errorf("listOrganizationProjects: %w", err)
	}
	out := make([]*dto.OrganizationProjectResponse, 0, len(rows))
	for _, p := range rows {
		out = append(out, organizationProjectToDTO(p))
	}
	return out, nil
}

// GetOrganizationProjectUseCase returns one project if the caller may view it.
type GetOrganizationProjectUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewGetOrganizationProjectUseCase constructs the use case.
func NewGetOrganizationProjectUseCase(repo orgRepo.OrganizationRepository) *GetOrganizationProjectUseCase {
	return &GetOrganizationProjectUseCase{repo: repo}
}

// Execute loads a project by ID.
func (uc *GetOrganizationProjectUseCase) Execute(ctx context.Context, projectID, callerUserID uuid.UUID) (*dto.OrganizationProjectResponse, error) {
	p, err := ensureProjectViewer(ctx, uc.repo, projectID, callerUserID)
	if err != nil {
		return nil, err
	}
	return organizationProjectToDTO(p), nil
}

// ListOrganizationProjectMembersUseCase lists roster for a project.
type ListOrganizationProjectMembersUseCase struct {
	repo         orgRepo.OrganizationRepository
	getProfileUC *userUC.GetProfileUseCase
}

// NewListOrganizationProjectMembersUseCase constructs the use case.
func NewListOrganizationProjectMembersUseCase(
	repo orgRepo.OrganizationRepository,
	getProfileUC *userUC.GetProfileUseCase,
) *ListOrganizationProjectMembersUseCase {
	return &ListOrganizationProjectMembersUseCase{repo: repo, getProfileUC: getProfileUC}
}

// Execute returns project members with nicknames.
func (uc *ListOrganizationProjectMembersUseCase) Execute(ctx context.Context, projectID, callerUserID uuid.UUID) ([]*dto.OrganizationProjectMemberResponse, error) {
	if _, err := ensureProjectViewer(ctx, uc.repo, projectID, callerUserID); err != nil {
		return nil, err
	}
	members, err := uc.repo.ListOrganizationProjectMembers(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationProjectMembers: %w", err)
	}
	out := make([]*dto.OrganizationProjectMemberResponse, 0, len(members))
	for _, m := range members {
		nick := ""
		if p, err := uc.getProfileUC.Execute(ctx, m.UserID.String()); err == nil && p != nil {
			nick = p.Nickname
		}
		out = append(out, &dto.OrganizationProjectMemberResponse{
			ID:           m.ID.String(),
			ProjectID:    m.ProjectID.String(),
			UserID:       m.UserID.String(),
			UserNickname: nick,
			AddedAt:      m.AddedAt.Format(time.RFC3339),
		})
	}
	return out, nil
}

// ListOrganizationProjectTodosUseCase lists todos for a project.
type ListOrganizationProjectTodosUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewListOrganizationProjectTodosUseCase constructs the use case.
func NewListOrganizationProjectTodosUseCase(repo orgRepo.OrganizationRepository) *ListOrganizationProjectTodosUseCase {
	return &ListOrganizationProjectTodosUseCase{repo: repo}
}

// Execute returns todos (newest first from repo).
func (uc *ListOrganizationProjectTodosUseCase) Execute(ctx context.Context, projectID, callerUserID uuid.UUID) ([]*dto.OrganizationProjectTodoResponse, error) {
	if _, err := ensureProjectViewer(ctx, uc.repo, projectID, callerUserID); err != nil {
		return nil, err
	}
	rows, err := uc.repo.ListOrganizationProjectTodos(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationProjectTodos: %w", err)
	}
	out := make([]*dto.OrganizationProjectTodoResponse, 0, len(rows))
	for _, t := range rows {
		out = append(out, organizationProjectTodoToDTO(t))
	}
	return out, nil
}

func organizationProjectToDTO(p *model.OrganizationProject) *dto.OrganizationProjectResponse {
	return &dto.OrganizationProjectResponse{
		ID:              p.ID.String(),
		OrganizationID:  p.OrganizationID.String(),
		Name:            p.Name,
		Description:     p.Description,
		CreatedByUserID: p.CreatedByUserID.String(),
		CreatedAt:       p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       p.UpdatedAt.Format(time.RFC3339),
	}
}

func organizationProjectTodoToDTO(t *model.OrganizationProjectTodo) *dto.OrganizationProjectTodoResponse {
	st := string(t.Status)
	if st == "" {
		st = string(model.OrganizationProjectTodoOpen)
	}
	var assigned *string
	if t.AssignedToUserID != nil {
		s := t.AssignedToUserID.String()
		assigned = &s
	}
	resp := &dto.OrganizationProjectTodoResponse{
		ID:               t.ID.String(),
		ProjectID:        t.ProjectID.String(),
		Title:            t.Title,
		Status:           st,
		CreatedByUserID:  t.CreatedByUserID.String(),
		AssignedToUserID: assigned,
		CreatedAt:        t.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        t.UpdatedAt.Format(time.RFC3339),
	}
	if t.DueAt != nil {
		s := t.DueAt.UTC().Format(time.RFC3339)
		resp.DueAt = &s
	}
	return resp
}
