package usecase

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
)

type projectAccessRepoStub struct {
	project                    *model.OrganizationProject
	hostMember                 bool
	adminOrOwner               bool
	projectMember              bool
	participantReader          bool
	participantCapabilityByKey map[string]bool
}

func (s *projectAccessRepoStub) GetOrganizationProjectByID(context.Context, uuid.UUID) (*model.OrganizationProject, error) {
	return s.project, nil
}
func (s *projectAccessRepoStub) IsMember(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return s.hostMember, nil
}
func (s *projectAccessRepoStub) IsAdminOrOwner(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return s.adminOrOwner, nil
}
func (s *projectAccessRepoStub) IsOrganizationProjectMember(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return s.projectMember, nil
}
func (s *projectAccessRepoStub) UserMayViewProjectViaAcceptedParticipation(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return s.participantReader, nil
}
func (s *projectAccessRepoStub) UserHasProjectCapabilityViaAcceptedParticipation(_ context.Context, _ uuid.UUID, _ uuid.UUID, capabilityKey string) (bool, error) {
	return s.participantCapabilityByKey[capabilityKey], nil
}

func TestEnsureProjectTodoEditor_AllowsParticipantOrgCapability(t *testing.T) {
	t.Parallel()
	repo := &projectAccessRepoStub{
		project: &model.OrganizationProject{
			ID:             uuid.New(),
			OrganizationID: uuid.New(),
		},
		participantCapabilityByKey: map[string]bool{"todos": true},
	}
	if _, err := ensureProjectTodoEditor(context.Background(), repo, repo.project.ID, uuid.New()); err != nil {
		t.Fatalf("expected access, got error: %v", err)
	}
}

func TestEnsureProjectTodoEditor_RejectsMissingParticipantCapability(t *testing.T) {
	t.Parallel()
	repo := &projectAccessRepoStub{
		project: &model.OrganizationProject{
			ID:             uuid.New(),
			OrganizationID: uuid.New(),
		},
		participantCapabilityByKey: map[string]bool{"todos": false},
	}
	if _, err := ensureProjectTodoEditor(context.Background(), repo, repo.project.ID, uuid.New()); err == nil {
		t.Fatal("expected forbidden error when participant capability is missing")
	}
}

func TestEnsureProjectPurchaseEditor_UsesPurchaseCapability(t *testing.T) {
	t.Parallel()
	repo := &projectAccessRepoStub{
		project: &model.OrganizationProject{
			ID:             uuid.New(),
			OrganizationID: uuid.New(),
		},
		participantCapabilityByKey: map[string]bool{"purchases": true},
	}
	if _, err := ensureProjectPurchaseEditor(context.Background(), repo, repo.project.ID, uuid.New()); err != nil {
		t.Fatalf("expected purchase capability access, got error: %v", err)
	}
}

func TestGetOrganizationProjectMyCapabilities_PrioritizesParticipantCapabilities(t *testing.T) {
	t.Parallel()
	repo := &projectAccessRepoStub{
		project: &model.OrganizationProject{
			ID:             uuid.New(),
			OrganizationID: uuid.New(),
		},
		hostMember:                 true,
		adminOrOwner:               true,
		participantReader:          true,
		participantCapabilityByKey: map[string]bool{"todos": false, "purchases": false},
	}
	caps, err := getOrganizationProjectMyCapabilities(context.Background(), repo, repo.project.ID, uuid.New())
	if err != nil {
		t.Fatalf("expected capabilities, got error: %v", err)
	}
	if caps.CanEditTodos || caps.CanEditPurchases {
		t.Fatalf("expected participant capabilities to deny writes, got todos=%v purchases=%v", caps.CanEditTodos, caps.CanEditPurchases)
	}
}
