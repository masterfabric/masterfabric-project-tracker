package repository

import (
	"context"

	"github.com/google/uuid"
	feedbackmodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/model"
)

// FeedbackRepository persists feedback threads and messages.
type FeedbackRepository interface {
	CreateThreadWithMessage(ctx context.Context, userID *uuid.UUID, guestContactEmail, subject, body string) (*feedbackmodel.ThreadWithMessages, error)
	ListThreadsWithMessagesByUser(ctx context.Context, userID uuid.UUID) ([]feedbackmodel.ThreadWithMessages, error)
	AdminListThreadsWithMessages(ctx context.Context, limit int) ([]feedbackmodel.ThreadWithUser, error)
	AddMessage(ctx context.Context, threadID uuid.UUID, role feedbackmodel.AuthorRole, body string) (*feedbackmodel.Message, error)
	GetThreadUserID(ctx context.Context, threadID uuid.UUID) (uuid.UUID, error)
	// DeleteThread removes a thread; messages are removed via ON DELETE CASCADE.
	DeleteThread(ctx context.Context, threadID uuid.UUID) error
}
