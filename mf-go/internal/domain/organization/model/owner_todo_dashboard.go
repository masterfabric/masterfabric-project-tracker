// Package model — GFG-174 owner dashboard aggregate result (DB layer + use case).
package model

import (
	"time"

	"github.com/google/uuid"
)

// OwnerTodoDashboardStats is the raw aggregate result from the repository.
type OwnerTodoDashboardStats struct {
	OpenCount  int
	DoneCount  int
	CompSel    int
	CompPrev   int
	Daily      []OwnerDashboardDayBucket
	Donut2     []OwnerProjectDoneInPeriod
	Assignee   []OwnerAssigneeOpenSlice
}

// OwnerDashboardDayBucket is one UTC calendar day in the series.
type OwnerDashboardDayBucket struct {
	Day            time.Time
	CompletedCount int
}

// OwnerProjectDoneInPeriod is done-in-period by project (or General).
type OwnerProjectDoneInPeriod struct {
	ProjectID   *uuid.UUID
	ProjectName *string
	IsGeneral   bool
	Count       int
}

// OwnerAssigneeOpenSlice groups open (not done) units by assignee.
type OwnerAssigneeOpenSlice struct {
	UserID    *uuid.UUID
	Nickname  string
	OpenCount int
}
