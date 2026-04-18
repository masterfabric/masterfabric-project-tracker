package dto

import "time"

// FeedbackMessageResponse is one timeline row.
type FeedbackMessageResponse struct {
	ID         string
	ThreadID   string
	AuthorRole string
	Body       string
	CreatedAt  time.Time
}

// FeedbackThreadResponse is a thread with messages (chronological).
type FeedbackThreadResponse struct {
	ID              string
	UserID          string // empty for guest-only threads
	ContactEmail    string // guest email, or mirrors profile when signed in (optional)
	Subject         string
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	Messages        []*FeedbackMessageResponse
}

// AdminFeedbackThreadResponse includes submitter fields for admin UI.
type AdminFeedbackThreadResponse struct {
	Thread          *FeedbackThreadResponse
	UserEmail       string
	UserDisplayName string
}

// SubmitFeedbackRequest is user-submitted feedback.
type SubmitFeedbackRequest struct {
	Subject       string
	Message       string
	ContactEmail  string // required when caller is not authenticated
}

// AdminReplyRequest is an admin reply on a thread.
type AdminReplyRequest struct {
	ThreadID string
	Message  string
}
