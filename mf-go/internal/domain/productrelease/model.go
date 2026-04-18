package productrelease

import (
	"time"

	"github.com/google/uuid"
)

// ProductRelease is the admin-published version and changelog shown to all clients.
type ProductRelease struct {
	Version              string
	ChangelogMarkdown    string
	UpdatedAt            time.Time
	UpdatedByUserID      *uuid.UUID
	UpdatedByDisplayName string
}
