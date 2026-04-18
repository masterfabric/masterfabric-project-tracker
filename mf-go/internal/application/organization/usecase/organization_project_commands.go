package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/push"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// CreateOrganizationProjectUseCase creates a project (org admin/owner); creator is added to the roster.
type CreateOrganizationProjectUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewCreateOrganizationProjectUseCase constructs the use case.
func NewCreateOrganizationProjectUseCase(repo orgRepo.OrganizationRepository) *CreateOrganizationProjectUseCase {
	return &CreateOrganizationProjectUseCase{repo: repo}
}

// Execute creates a project and adds the actor to project members.
func (uc *CreateOrganizationProjectUseCase) Execute(
	ctx context.Context,
	orgID, actorUserID uuid.UUID,
	name, description string,
) (*dto.OrganizationProjectResponse, error) {
	if err := ensureOrgAdminOrOwner(ctx, uc.repo, orgID, actorUserID); err != nil {
		return nil, err
	}
	n := strings.TrimSpace(name)
	if n == "" {
		return nil, fmt.Errorf("createOrganizationProject: name is required")
	}
	now := time.Now().UTC()
	p := &model.OrganizationProject{
		ID:              uuid.New(),
		OrganizationID:  orgID,
		Name:            n,
		Description:     strings.TrimSpace(description),
		CreatedByUserID: actorUserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := uc.repo.CreateOrganizationProject(ctx, p); err != nil {
		return nil, fmt.Errorf("createOrganizationProject: %w", err)
	}
	m := &model.OrganizationProjectMember{
		ID:        uuid.New(),
		ProjectID: p.ID,
		UserID:    actorUserID,
		AddedAt:   now,
	}
	if err := uc.repo.AddOrganizationProjectMember(ctx, m); err != nil {
		return nil, fmt.Errorf("createOrganizationProject: add creator to roster: %w", err)
	}
	return organizationProjectToDTO(p), nil
}

// UpdateOrganizationProjectUseCase updates project name/description (org admin/owner).
type UpdateOrganizationProjectUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewUpdateOrganizationProjectUseCase constructs the use case.
func NewUpdateOrganizationProjectUseCase(repo orgRepo.OrganizationRepository) *UpdateOrganizationProjectUseCase {
	return &UpdateOrganizationProjectUseCase{repo: repo}
}

// Execute updates fields.
func (uc *UpdateOrganizationProjectUseCase) Execute(
	ctx context.Context,
	projectID, actorUserID uuid.UUID,
	name *string,
	description *string,
) (*dto.OrganizationProjectResponse, error) {
	p, err := uc.repo.GetOrganizationProjectByID(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganizationProject: %w", err)
	}
	if p == nil {
		return nil, fmt.Errorf("updateOrganizationProject: project not found")
	}
	if err := ensureOrgAdminOrOwner(ctx, uc.repo, p.OrganizationID, actorUserID); err != nil {
		return nil, err
	}
	if name != nil {
		nn := strings.TrimSpace(*name)
		if nn == "" {
			return nil, fmt.Errorf("updateOrganizationProject: name cannot be empty")
		}
		p.Name = nn
	}
	if description != nil {
		p.Description = strings.TrimSpace(*description)
	}
	p.UpdatedAt = time.Now().UTC()
	if err := uc.repo.UpdateOrganizationProject(ctx, p); err != nil {
		return nil, fmt.Errorf("updateOrganizationProject: %w", err)
	}
	return organizationProjectToDTO(p), nil
}

// DeleteOrganizationProjectUseCase deletes a project (org admin/owner).
type DeleteOrganizationProjectUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewDeleteOrganizationProjectUseCase constructs the use case.
func NewDeleteOrganizationProjectUseCase(repo orgRepo.OrganizationRepository) *DeleteOrganizationProjectUseCase {
	return &DeleteOrganizationProjectUseCase{repo: repo}
}

// Execute deletes by id.
func (uc *DeleteOrganizationProjectUseCase) Execute(ctx context.Context, projectID, actorUserID uuid.UUID) error {
	p, err := uc.repo.GetOrganizationProjectByID(ctx, projectID)
	if err != nil {
		return fmt.Errorf("deleteOrganizationProject: %w", err)
	}
	if p == nil {
		return fmt.Errorf("deleteOrganizationProject: project not found")
	}
	if err := ensureOrgAdminOrOwner(ctx, uc.repo, p.OrganizationID, actorUserID); err != nil {
		return err
	}
	if err := uc.repo.DeleteOrganizationProject(ctx, projectID); err != nil {
		return fmt.Errorf("deleteOrganizationProject: %w", err)
	}
	return nil
}

// AddOrganizationProjectMemberUseCase adds an org member to the project (admin/owner).
type AddOrganizationProjectMemberUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewAddOrganizationProjectMemberUseCase constructs the use case.
func NewAddOrganizationProjectMemberUseCase(repo orgRepo.OrganizationRepository) *AddOrganizationProjectMemberUseCase {
	return &AddOrganizationProjectMemberUseCase{repo: repo}
}

// Execute adds target user to project roster; target must be an active org member.
func (uc *AddOrganizationProjectMemberUseCase) Execute(ctx context.Context, projectID, actorUserID, targetUserID uuid.UUID) error {
	p, err := uc.repo.GetOrganizationProjectByID(ctx, projectID)
	if err != nil {
		return fmt.Errorf("addOrganizationProjectMember: %w", err)
	}
	if p == nil {
		return fmt.Errorf("addOrganizationProjectMember: project not found")
	}
	if err := ensureOrgAdminOrOwner(ctx, uc.repo, p.OrganizationID, actorUserID); err != nil {
		return err
	}
	ok, err := uc.repo.IsMember(ctx, p.OrganizationID, targetUserID)
	if err != nil {
		return fmt.Errorf("addOrganizationProjectMember: %w", err)
	}
	if !ok {
		return fmt.Errorf("addOrganizationProjectMember: user is not an active member of the organization")
	}
	now := time.Now().UTC()
	m := &model.OrganizationProjectMember{
		ID:        uuid.New(),
		ProjectID: projectID,
		UserID:    targetUserID,
		AddedAt:   now,
	}
	if err := uc.repo.AddOrganizationProjectMember(ctx, m); err != nil {
		return fmt.Errorf("addOrganizationProjectMember: %w", err)
	}
	return nil
}

// RemoveOrganizationProjectMemberUseCase removes a user from the project roster (admin/owner).
type RemoveOrganizationProjectMemberUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewRemoveOrganizationProjectMemberUseCase constructs the use case.
func NewRemoveOrganizationProjectMemberUseCase(repo orgRepo.OrganizationRepository) *RemoveOrganizationProjectMemberUseCase {
	return &RemoveOrganizationProjectMemberUseCase{repo: repo}
}

// Execute removes membership.
func (uc *RemoveOrganizationProjectMemberUseCase) Execute(ctx context.Context, projectID, actorUserID, targetUserID uuid.UUID) error {
	p, err := uc.repo.GetOrganizationProjectByID(ctx, projectID)
	if err != nil {
		return fmt.Errorf("removeOrganizationProjectMember: %w", err)
	}
	if p == nil {
		return fmt.Errorf("removeOrganizationProjectMember: project not found")
	}
	if err := ensureOrgAdminOrOwner(ctx, uc.repo, p.OrganizationID, actorUserID); err != nil {
		return err
	}
	if err := uc.repo.RemoveOrganizationProjectMember(ctx, projectID, targetUserID); err != nil {
		return fmt.Errorf("removeOrganizationProjectMember: %w", err)
	}
	return nil
}

// CreateOrganizationProjectTodoUseCase creates a todo (project member or org admin/owner).
type CreateOrganizationProjectTodoUseCase struct {
	repo orgRepo.OrganizationRepository
	push push.TodoOneSignal
}

// NewCreateOrganizationProjectTodoUseCase constructs the use case.
func NewCreateOrganizationProjectTodoUseCase(repo orgRepo.OrganizationRepository, p push.TodoOneSignal) *CreateOrganizationProjectTodoUseCase {
	return &CreateOrganizationProjectTodoUseCase{repo: repo, push: p}
}

// Execute inserts a todo with status open. Optional assignee: only org admin/owner may set it; assignee must be on the project roster.
// dueAtRFC3339 is optional due instant (UTC).
func (uc *CreateOrganizationProjectTodoUseCase) Execute(
	ctx context.Context,
	projectID, actorUserID uuid.UUID,
	title string,
	assignToUserID *uuid.UUID,
	dueAtRFC3339 *string,
) (*dto.OrganizationProjectTodoResponse, error) {
	p, err := ensureProjectTodoEditor(ctx, uc.repo, projectID, actorUserID)
	if err != nil {
		return nil, err
	}
	ti := strings.TrimSpace(title)
	if ti == "" {
		return nil, fmt.Errorf("createOrganizationProjectTodo: title is required")
	}
	var assigned *uuid.UUID
	if assignToUserID != nil && *assignToUserID != uuid.Nil {
		admin, aerr := uc.repo.IsAdminOrOwner(ctx, p.OrganizationID, actorUserID)
		if aerr != nil {
			return nil, fmt.Errorf("createOrganizationProjectTodo: %w", aerr)
		}
		if !admin {
			return nil, domainErr.New("FORBIDDEN", "only organization admin or owner may assign a project todo to another member", nil)
		}
		onRoster, rerr := uc.repo.IsOrganizationProjectMember(ctx, projectID, *assignToUserID)
		if rerr != nil {
			return nil, fmt.Errorf("createOrganizationProjectTodo: %w", rerr)
		}
		if !onRoster {
			return nil, domainErr.New("VALIDATION_ERROR", "assignee must be on the project roster", nil)
		}
		assigned = assignToUserID
	}
	now := time.Now().UTC()
	t := &model.OrganizationProjectTodo{
		ID:               uuid.New(),
		ProjectID:        projectID,
		Title:            ti,
		Status:           model.OrganizationProjectTodoOpen,
		CreatedByUserID:  actorUserID,
		AssignedToUserID: assigned,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if dueAtRFC3339 != nil && *dueAtRFC3339 != "" {
		parsed, err := time.Parse(time.RFC3339, *dueAtRFC3339)
		if err != nil {
			return nil, fmt.Errorf("createOrganizationProjectTodo: invalid dueAt: %w", err)
		}
		u := parsed.UTC()
		t.DueAt = &u
	}
	if err := uc.repo.CreateOrganizationProjectTodo(ctx, t); err != nil {
		return nil, fmt.Errorf("createOrganizationProjectTodo: %w", err)
	}
	if uc.push != nil {
		uc.push.OrgProjectTodoSaved(ctx, nil, t, actorUserID)
	}
	return organizationProjectTodoToDTO(t), nil
}

// UpdateOrganizationProjectTodoUseCase updates title and/or status.
type UpdateOrganizationProjectTodoUseCase struct {
	repo orgRepo.OrganizationRepository
	push push.TodoOneSignal
}

// NewUpdateOrganizationProjectTodoUseCase constructs the use case.
func NewUpdateOrganizationProjectTodoUseCase(repo orgRepo.OrganizationRepository, p push.TodoOneSignal) *UpdateOrganizationProjectTodoUseCase {
	return &UpdateOrganizationProjectTodoUseCase{repo: repo, push: p}
}

// Execute updates a todo; todo must belong to a project the user can edit.
func (uc *UpdateOrganizationProjectTodoUseCase) Execute(
	ctx context.Context,
	todoID, actorUserID uuid.UUID,
	title *string,
	status *string,
	dueAtRFC3339 *string,
	clearDueAt *bool,
) (*dto.OrganizationProjectTodoResponse, error) {
	existing, err := uc.repo.GetOrganizationProjectTodoByID(ctx, todoID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganizationProjectTodo: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("updateOrganizationProjectTodo: todo not found")
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, existing.ProjectID, actorUserID); err != nil {
		return nil, err
	}
	before := cloneOrganizationProjectTodo(existing)
	if title != nil {
		nt := strings.TrimSpace(*title)
		if nt == "" {
			return nil, fmt.Errorf("updateOrganizationProjectTodo: title cannot be empty")
		}
		existing.Title = nt
	}
	if status != nil {
		s := strings.ToUpper(strings.TrimSpace(*status))
		switch s {
		case "OPEN":
			existing.Status = model.OrganizationProjectTodoOpen
		case "DONE":
			existing.Status = model.OrganizationProjectTodoDone
		default:
			return nil, fmt.Errorf("updateOrganizationProjectTodo: invalid status")
		}
	}
	if clearDueAt != nil && *clearDueAt {
		existing.DueAt = nil
	} else if dueAtRFC3339 != nil {
		parsed, err := time.Parse(time.RFC3339, *dueAtRFC3339)
		if err != nil {
			return nil, fmt.Errorf("updateOrganizationProjectTodo: invalid dueAt: %w", err)
		}
		u := parsed.UTC()
		existing.DueAt = &u
	}
	existing.UpdatedAt = time.Now().UTC()
	if err := uc.repo.UpdateOrganizationProjectTodo(ctx, existing); err != nil {
		return nil, fmt.Errorf("updateOrganizationProjectTodo: %w", err)
	}
	if uc.push != nil {
		uc.push.OrgProjectTodoSaved(ctx, before, existing, actorUserID)
	}
	return organizationProjectTodoToDTO(existing), nil
}

// DeleteOrganizationProjectTodoUseCase deletes a todo.
type DeleteOrganizationProjectTodoUseCase struct {
	repo orgRepo.OrganizationRepository
	push push.TodoOneSignal
}

// NewDeleteOrganizationProjectTodoUseCase constructs the use case.
func NewDeleteOrganizationProjectTodoUseCase(repo orgRepo.OrganizationRepository, p push.TodoOneSignal) *DeleteOrganizationProjectTodoUseCase {
	return &DeleteOrganizationProjectTodoUseCase{repo: repo, push: p}
}

// Execute deletes by todo id.
func (uc *DeleteOrganizationProjectTodoUseCase) Execute(ctx context.Context, todoID, actorUserID uuid.UUID) error {
	existing, err := uc.repo.GetOrganizationProjectTodoByID(ctx, todoID)
	if err != nil {
		return fmt.Errorf("deleteOrganizationProjectTodo: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("deleteOrganizationProjectTodo: todo not found")
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, existing.ProjectID, actorUserID); err != nil {
		return err
	}
	if uc.push != nil {
		uc.push.OrgProjectTodoDeleting(ctx, todoID)
	}
	if err := uc.repo.DeleteOrganizationProjectTodo(ctx, todoID); err != nil {
		return fmt.Errorf("deleteOrganizationProjectTodo: %w", err)
	}
	return nil
}

func cloneOrganizationProjectTodo(t *model.OrganizationProjectTodo) *model.OrganizationProjectTodo {
	if t == nil {
		return nil
	}
	c := *t
	if t.AssignedToUserID != nil {
		x := *t.AssignedToUserID
		c.AssignedToUserID = &x
	}
	if t.DueAt != nil {
		x := *t.DueAt
		c.DueAt = &x
	}
	return &c
}
