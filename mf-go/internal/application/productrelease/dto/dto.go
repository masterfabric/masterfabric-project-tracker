package dto

import "time"

// ProductReleaseResponse is the published product version payload for GraphQL.
type ProductReleaseResponse struct {
	Version              string
	ChangelogMarkdown    string
	UpdatedAt            time.Time
	UpdatedByDisplayName *string
}

// AdminUpdateProductReleaseRequest is input for admin mutation.
type AdminUpdateProductReleaseRequest struct {
	Version           string
	ChangelogMarkdown string
}
