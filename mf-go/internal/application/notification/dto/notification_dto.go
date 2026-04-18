package dto

// NotificationResponse is the output for notification operations.
type NotificationResponse struct {
	ID        string
	Title     string
	Subtitle  string
	Message   string
	Type      string
	Category  string
	Icon      string
	Language  string
	ActionURL string
	ImageURL  string
	Priority  string
	CreatedAt string
	UpdatedAt string
}

// NotificationWithReadResponse extends NotificationResponse with read status.
type NotificationWithReadResponse struct {
	NotificationResponse
	IsRead bool
}

// CreateNotificationRequest is the input for admin creating a broadcast.
type CreateNotificationRequest struct {
	Title     string
	Subtitle  string
	Message   string
	Type      string
	Category  string
	Icon      string
	Language  string
	ActionURL string
	ImageURL  string
	Priority  string
	// SendPush triggers an async OneSignal segment push (mf-go only; requires REST API key on server).
	SendPush bool
}

// ListNotificationsRequest is the input for listing notifications.
type ListNotificationsRequest struct {
	UserID   string
	Language string
	Limit    int
}

// MarkNotificationReadRequest is the input for marking one as read.
type MarkNotificationReadRequest struct {
	UserID         string
	NotificationID string
}
