package usecase

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	orgRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
)

const (
	maxPurchaseProductNameLen = 500
	maxPurchasePurposeLen     = 2000
	maxPurchaseStatusNoteLen  = 2000
	maxPurchaseProductLinkLen = 2048
	maxPurchaseCurrencyLen    = 8
)

// ListOrganizationProjectPurchasesUseCase lists purchases for a project (same visibility as todos).
type ListOrganizationProjectPurchasesUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewListOrganizationProjectPurchasesUseCase constructs the use case.
func NewListOrganizationProjectPurchasesUseCase(repo orgRepo.OrganizationRepository) *ListOrganizationProjectPurchasesUseCase {
	return &ListOrganizationProjectPurchasesUseCase{repo: repo}
}

// Execute returns purchases for the project.
func (uc *ListOrganizationProjectPurchasesUseCase) Execute(ctx context.Context, projectID, callerUserID uuid.UUID) ([]*dto.OrganizationProjectPurchaseResponse, error) {
	if _, err := ensureProjectReader(ctx, uc.repo, projectID, callerUserID); err != nil {
		return nil, err
	}
	rows, err := uc.repo.ListOrganizationProjectPurchases(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("listOrganizationProjectPurchases: %w", err)
	}
	out := make([]*dto.OrganizationProjectPurchaseResponse, 0, len(rows))
	for _, p := range rows {
		out = append(out, organizationProjectPurchaseToDTO(p))
	}
	return out, nil
}

// CreateOrganizationProjectPurchaseUseCase creates a line item (project roster or org admin/owner).
type CreateOrganizationProjectPurchaseUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewCreateOrganizationProjectPurchaseUseCase constructs the use case.
func NewCreateOrganizationProjectPurchaseUseCase(repo orgRepo.OrganizationRepository) *CreateOrganizationProjectPurchaseUseCase {
	return &CreateOrganizationProjectPurchaseUseCase{repo: repo}
}

// Execute inserts a purchase; status defaults to requested when empty.
func (uc *CreateOrganizationProjectPurchaseUseCase) Execute(
	ctx context.Context,
	projectID, actorUserID uuid.UUID,
	productName string,
	taxRate, price, quantity float64,
	productPurpose string,
	productLink *string,
	currency string,
	status *string,
	statusNote string,
) (*dto.OrganizationProjectPurchaseResponse, error) {
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, projectID, actorUserID); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(productName)
	if name == "" {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: productName is required")
	}
	if utf8.RuneCountInString(name) > maxPurchaseProductNameLen {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: productName too long")
	}
	if quantity <= 0 {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: quantity must be positive")
	}
	if price < 0 {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: price cannot be negative")
	}
	if taxRate < 0 {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: taxRate cannot be negative")
	}
	purpose := strings.TrimSpace(productPurpose)
	if utf8.RuneCountInString(purpose) > maxPurchasePurposeLen {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: productPurpose too long")
	}
	note := strings.TrimSpace(statusNote)
	if utf8.RuneCountInString(note) > maxPurchaseStatusNoteLen {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: statusNote too long")
	}
	ccy, err := normalizePurchaseCurrency(currency)
	if err != nil {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: %w", err)
	}
	var st model.OrganizationProjectPurchaseStatus
	if status == nil || strings.TrimSpace(*status) == "" {
		st = model.OrganizationProjectPurchaseRequested
	} else {
		var err error
		st, err = parsePurchaseStatusCreate(*status)
		if err != nil {
			return nil, err
		}
	}
	var link *string
	if productLink != nil {
		l := strings.TrimSpace(*productLink)
		if l != "" {
			if len(l) > maxPurchaseProductLinkLen {
				return nil, fmt.Errorf("createOrganizationProjectPurchase: productLink too long")
			}
			link = &l
		}
	}
	now := time.Now().UTC()
	p := &model.OrganizationProjectPurchase{
		ID:              uuid.New(),
		ProjectID:       projectID,
		ProductName:     name,
		TaxRate:         taxRate,
		ProductPurpose:  purpose,
		Price:           price,
		Quantity:        quantity,
		ProductLink:     link,
		Status:          st,
		StatusNote:      note,
		Currency:        ccy,
		CreatedByUserID: actorUserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := uc.repo.CreateOrganizationProjectPurchase(ctx, p); err != nil {
		return nil, fmt.Errorf("createOrganizationProjectPurchase: %w", err)
	}
	return organizationProjectPurchaseToDTO(p), nil
}

// UpdateOrganizationProjectPurchaseUseCase updates fields on a line item.
type UpdateOrganizationProjectPurchaseUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewUpdateOrganizationProjectPurchaseUseCase constructs the use case.
func NewUpdateOrganizationProjectPurchaseUseCase(repo orgRepo.OrganizationRepository) *UpdateOrganizationProjectPurchaseUseCase {
	return &UpdateOrganizationProjectPurchaseUseCase{repo: repo}
}

// Execute updates non-nil pointer fields. Use clearProductLink: true to remove the URL; otherwise productLink sets/replaces when provided.
func (uc *UpdateOrganizationProjectPurchaseUseCase) Execute(
	ctx context.Context,
	purchaseID, actorUserID uuid.UUID,
	productName *string,
	taxRate *float64,
	productPurpose *string,
	price *float64,
	quantity *float64,
	productLink *string,
	clearProductLink *bool,
	status *string,
	statusNote *string,
	currency *string,
) (*dto.OrganizationProjectPurchaseResponse, error) {
	existing, err := uc.repo.GetOrganizationProjectPurchaseByID(ctx, purchaseID)
	if err != nil {
		return nil, fmt.Errorf("updateOrganizationProjectPurchase: %w", err)
	}
	if existing == nil {
		return nil, fmt.Errorf("updateOrganizationProjectPurchase: purchase not found")
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, existing.ProjectID, actorUserID); err != nil {
		return nil, err
	}
	if productName != nil {
		n := strings.TrimSpace(*productName)
		if n == "" {
			return nil, fmt.Errorf("updateOrganizationProjectPurchase: productName cannot be empty")
		}
		if utf8.RuneCountInString(n) > maxPurchaseProductNameLen {
			return nil, fmt.Errorf("updateOrganizationProjectPurchase: productName too long")
		}
		existing.ProductName = n
	}
	if taxRate != nil {
		if *taxRate < 0 {
			return nil, fmt.Errorf("updateOrganizationProjectPurchase: taxRate cannot be negative")
		}
		existing.TaxRate = *taxRate
	}
	if productPurpose != nil {
		p := strings.TrimSpace(*productPurpose)
		if utf8.RuneCountInString(p) > maxPurchasePurposeLen {
			return nil, fmt.Errorf("updateOrganizationProjectPurchase: productPurpose too long")
		}
		existing.ProductPurpose = p
	}
	if price != nil {
		if *price < 0 {
			return nil, fmt.Errorf("updateOrganizationProjectPurchase: price cannot be negative")
		}
		existing.Price = *price
	}
	if quantity != nil {
		if *quantity <= 0 {
			return nil, fmt.Errorf("updateOrganizationProjectPurchase: quantity must be positive")
		}
		existing.Quantity = *quantity
	}
	if clearProductLink != nil && *clearProductLink {
		existing.ProductLink = nil
	} else if productLink != nil {
		l := strings.TrimSpace(*productLink)
		if l == "" {
			existing.ProductLink = nil
		} else {
			if len(l) > maxPurchaseProductLinkLen {
				return nil, fmt.Errorf("updateOrganizationProjectPurchase: productLink too long")
			}
			existing.ProductLink = &l
		}
	}
	if status != nil {
		st, err := parsePurchaseStatusUpdate(*status)
		if err != nil {
			return nil, err
		}
		existing.Status = st
	}
	if statusNote != nil {
		n := strings.TrimSpace(*statusNote)
		if utf8.RuneCountInString(n) > maxPurchaseStatusNoteLen {
			return nil, fmt.Errorf("updateOrganizationProjectPurchase: statusNote too long")
		}
		existing.StatusNote = n
	}
	if currency != nil {
		ccy, err := normalizePurchaseCurrency(*currency)
		if err != nil {
			return nil, fmt.Errorf("updateOrganizationProjectPurchase: %w", err)
		}
		existing.Currency = ccy
	}
	existing.UpdatedAt = time.Now().UTC()
	if err := uc.repo.UpdateOrganizationProjectPurchase(ctx, existing); err != nil {
		return nil, fmt.Errorf("updateOrganizationProjectPurchase: %w", err)
	}
	return organizationProjectPurchaseToDTO(existing), nil
}

// DeleteOrganizationProjectPurchaseUseCase deletes a line item.
type DeleteOrganizationProjectPurchaseUseCase struct {
	repo orgRepo.OrganizationRepository
}

// NewDeleteOrganizationProjectPurchaseUseCase constructs the use case.
func NewDeleteOrganizationProjectPurchaseUseCase(repo orgRepo.OrganizationRepository) *DeleteOrganizationProjectPurchaseUseCase {
	return &DeleteOrganizationProjectPurchaseUseCase{repo: repo}
}

// Execute deletes by id.
func (uc *DeleteOrganizationProjectPurchaseUseCase) Execute(ctx context.Context, purchaseID, actorUserID uuid.UUID) error {
	existing, err := uc.repo.GetOrganizationProjectPurchaseByID(ctx, purchaseID)
	if err != nil {
		return fmt.Errorf("deleteOrganizationProjectPurchase: %w", err)
	}
	if existing == nil {
		return fmt.Errorf("deleteOrganizationProjectPurchase: purchase not found")
	}
	if _, err := ensureProjectTodoEditor(ctx, uc.repo, existing.ProjectID, actorUserID); err != nil {
		return err
	}
	if err := uc.repo.DeleteOrganizationProjectPurchase(ctx, purchaseID); err != nil {
		return fmt.Errorf("deleteOrganizationProjectPurchase: %w", err)
	}
	return nil
}

func organizationProjectPurchaseToDTO(p *model.OrganizationProjectPurchase) *dto.OrganizationProjectPurchaseResponse {
	st := strings.ToUpper(string(p.Status))
	if st == "" {
		st = "REQUESTED"
	}
	return &dto.OrganizationProjectPurchaseResponse{
		ID:              p.ID.String(),
		ProjectID:       p.ProjectID.String(),
		ProductName:     p.ProductName,
		TaxRate:         p.TaxRate,
		ProductPurpose:  p.ProductPurpose,
		Price:           p.Price,
		Quantity:        p.Quantity,
		ProductLink:     p.ProductLink,
		Status:          st,
		StatusNote:      p.StatusNote,
		Currency:        p.Currency,
		CreatedByUserID: p.CreatedByUserID.String(),
		CreatedAt:       p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       p.UpdatedAt.Format(time.RFC3339),
	}
}

func normalizePurchaseCurrency(raw string) (string, error) {
	s := strings.TrimSpace(strings.ToUpper(raw))
	if s == "" {
		return "TRY", nil
	}
	if len(s) > maxPurchaseCurrencyLen {
		return "", fmt.Errorf("currency code too long")
	}
	for _, r := range s {
		if r > unicode.MaxASCII || !unicode.IsLetter(r) {
			return "", fmt.Errorf("currency must be ASCII letters only")
		}
	}
	return s, nil
}

func parsePurchaseStatusCreate(s string) (model.OrganizationProjectPurchaseStatus, error) {
	t := strings.TrimSpace(strings.ToLower(s))
	switch t {
	case "requested":
		return model.OrganizationProjectPurchaseRequested, nil
	case "purchased":
		return model.OrganizationProjectPurchasePurchased, nil
	case "cancelled":
		return model.OrganizationProjectPurchaseCancelled, nil
	default:
		return "", fmt.Errorf("createOrganizationProjectPurchase: invalid status")
	}
}

func parsePurchaseStatusUpdate(s string) (model.OrganizationProjectPurchaseStatus, error) {
	t := strings.TrimSpace(strings.ToLower(s))
	switch t {
	case "requested":
		return model.OrganizationProjectPurchaseRequested, nil
	case "purchased":
		return model.OrganizationProjectPurchasePurchased, nil
	case "cancelled":
		return model.OrganizationProjectPurchaseCancelled, nil
	default:
		return "", fmt.Errorf("updateOrganizationProjectPurchase: invalid status")
	}
}
