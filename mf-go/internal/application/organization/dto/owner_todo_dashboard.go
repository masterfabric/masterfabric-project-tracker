// Package dto — organization owner todo dashboard (GFG-174).
package dto

import (
	"time"

	omodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
)

// OwnerTodoDashboardRequest is the use case input.
type OwnerTodoDashboardRequest struct {
	OrganizationID  string
	ActorUserID     string
	PeriodWeek      bool
	PeriodOffset    int
	IncludeSubtasks bool
	ProjectIDs      []string
}

// OwnerTodoDashboardResponse is returned to the GraphQL layer.
type OwnerTodoDashboardResponse struct {
	Period              string
	IncludeSubtasks     bool
	PeriodStart         time.Time
	PeriodEnd           time.Time
	PreviousPeriodStart time.Time
	PreviousPeriodEnd   time.Time
	OpenCount           int
	DoneCount           int
	CompletedInSelected int
	CompletedInPrevious int
	Daily               []omodel.OwnerDashboardDayBucket
	Donut2              []omodel.OwnerProjectDoneInPeriod
	Assignee            []omodel.OwnerAssigneeOpenSlice
}
