package productrelease

import (
	"context"

	"github.com/google/uuid"
)

// Repository persists the single product_release row.
type Repository interface {
	Get(ctx context.Context) (*ProductRelease, error)
	Update(ctx context.Context, version, changelogMarkdown string, updatedByUserID *uuid.UUID) (*ProductRelease, error)
}
