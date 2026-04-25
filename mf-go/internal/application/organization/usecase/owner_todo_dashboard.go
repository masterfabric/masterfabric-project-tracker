package usecase

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/organization/dto"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/repository"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// OwnerTodoDashboardUseCase returns org owner todo aggregates (GFG-174).
type OwnerTodoDashboardUseCase struct {
	repo repository.OrganizationRepository
}

// NewOwnerTodoDashboardUseCase constructs the use case.
func NewOwnerTodoDashboardUseCase(repo repository.OrganizationRepository) *OwnerTodoDashboardUseCase {
	return &OwnerTodoDashboardUseCase{repo: repo}
}

// Execute loads dashboard stats; caller must be org owner.
func (uc *OwnerTodoDashboardUseCase) Execute(ctx context.Context, req *dto.OwnerTodoDashboardRequest) (*dto.OwnerTodoDashboardResponse, error) {
	actor, err := uuid.Parse(req.ActorUserID)
	if err != nil {
		return nil, domainErr.New("UNAUTHENTICATED", "authentication required", nil)
	}
	orgID, err := uuid.Parse(req.OrganizationID)
	if err != nil {
		return nil, domainErr.New("BAD_USER_INPUT", "invalid organizationId", nil)
	}
	if req.PeriodOffset < 0 {
		return nil, domainErr.New("BAD_USER_INPUT", "periodOffset must be non-negative", nil)
	}

	org, err := uc.repo.GetByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("ownerTodoDashboard: %w", err)
	}
	if org == nil {
		return nil, domainErr.New("NOT_FOUND", "organization not found", nil)
	}
	if org.OwnerUserID != actor {
		return nil, domainErr.New("FORBIDDEN", "only the organization owner can view the todo dashboard", nil)
	}

	var pids []uuid.UUID
	if len(req.ProjectIDs) > 0 {
		for _, s := range req.ProjectIDs {
			id, perr := uuid.Parse(s)
			if perr != nil {
				return nil, domainErr.New("BAD_USER_INPUT", "invalid project id", nil)
			}
			pids = append(pids, id)
		}
		projects, lerr := uc.repo.ListOrganizationProjectsByOrgID(ctx, orgID)
		if lerr != nil {
			return nil, lerr
		}
		valid := make(map[uuid.UUID]struct{}, len(projects))
		for _, p := range projects {
			valid[p.ID] = struct{}{}
		}
		for _, id := range pids {
			if _, ok := valid[id]; !ok {
				return nil, domainErr.New("BAD_USER_INPUT", "project does not belong to the organization", nil)
			}
		}
	}

	var pStart, pEnd time.Time
	if req.PeriodWeek {
		pStart, pEnd = weekBoundsUTC(req.PeriodOffset)
	} else {
		pStart, pEnd = monthBoundsUTC(req.PeriodOffset)
	}
	prevStart, prevEnd := previousWindowBounds(req.PeriodWeek, pStart, pEnd)

	stats, err := uc.repo.GetOwnerTodoDashboardStats(ctx, orgID, pids, req.IncludeSubtasks, pStart, pEnd, prevStart, prevEnd)
	if err != nil {
		return nil, err
	}

	period := "MONTH"
	if req.PeriodWeek {
		period = "WEEK"
	}
	return &dto.OwnerTodoDashboardResponse{
		Period:              period,
		IncludeSubtasks:     req.IncludeSubtasks,
		PeriodStart:         pStart,
		PeriodEnd:           pEnd,
		PreviousPeriodStart: prevStart,
		PreviousPeriodEnd:   prevEnd,
		OpenCount:           stats.OpenCount,
		DoneCount:           stats.DoneCount,
		CompletedInSelected: stats.CompSel,
		CompletedInPrevious: stats.CompPrev,
		Daily:               stats.Daily,
		Donut2:              stats.Donut2,
		Assignee:            stats.Assignee,
	}, nil
}

// weekBoundsUTC: ISO week Monday 00:00 UTC through next Monday 00:00 UTC (half-open in SQL we use < end).
func weekBoundsUTC(periodOffset int) (start, end time.Time) {
	now := time.Now().UTC()
	daysFromMon := (int(now.Weekday()) + 6) % 7
	thisMonday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -daysFromMon)
	sel := thisMonday.AddDate(0, 0, -7*periodOffset)
	return sel, sel.AddDate(0, 0, 7)
}

func monthBoundsUTC(periodOffset int) (start, end time.Time) {
	now := time.Now().UTC()
	y, m, _ := now.Date()
	first := time.Date(y, m, 1, 0, 0, 0, 0, time.UTC)
	sel := first.AddDate(0, -periodOffset, 0)
	return sel, sel.AddDate(0, 1, 0)
}

func previousWindowBounds(week bool, pStart, pEnd time.Time) (time.Time, time.Time) {
	if week {
		ps := pStart.AddDate(0, 0, -7)
		return ps, pStart
	}
	return pStart.AddDate(0, -1, 0), pStart
}
