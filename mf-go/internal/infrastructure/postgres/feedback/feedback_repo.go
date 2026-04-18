package feedback

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	feedbackmodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/feedback/model"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// Repo implements feedback.FeedbackRepository.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo constructs Repo.
func NewRepo(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

func uuidPtrFromPgUUID(p pgtype.UUID) *uuid.UUID {
	if !p.Valid {
		return nil
	}
	u := uuid.UUID(p.Bytes)
	return &u
}

func scanThreadBase(row interface {
	Scan(dest ...any) error
}) (feedbackmodel.Thread, error) {
	var t feedbackmodel.Thread
	var pgUID pgtype.UUID
	err := row.Scan(
		&t.ID,
		&pgUID,
		&t.GuestContactEmail,
		&t.Subject,
		&t.Status,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if err != nil {
		return t, err
	}
	t.UserID = uuidPtrFromPgUUID(pgUID)
	return t, nil
}

// CreateThreadWithMessage starts a thread and inserts the first USER message.
// userID nil = guest thread (guestContactEmail should be non-empty).
func (r *Repo) CreateThreadWithMessage(ctx context.Context, userID *uuid.UUID, guestContactEmail, subject, body string) (*feedbackmodel.ThreadWithMessages, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("feedbackRepo.Begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	threadID := uuid.New()
	msgID := uuid.New()
	now := time.Now().UTC()

	const insThread = `
		INSERT INTO feedback_threads (id, user_id, guest_contact_email, subject, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'open', $5, $6)`
	if _, err := tx.Exec(ctx, insThread, threadID, userID, guestContactEmail, subject, now, now); err != nil {
		return nil, fmt.Errorf("feedbackRepo.insertThread: %w", err)
	}

	const insMsg = `
		INSERT INTO feedback_messages (id, thread_id, author_role, body, created_at)
		VALUES ($1, $2, 'USER', $3, $4)`
	if _, err := tx.Exec(ctx, insMsg, msgID, threadID, body, now); err != nil {
		return nil, fmt.Errorf("feedbackRepo.insertFirstMessage: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("feedbackRepo.Commit: %w", err)
	}

	return &feedbackmodel.ThreadWithMessages{
		Thread: feedbackmodel.Thread{
			ID:                threadID,
			UserID:            userID,
			GuestContactEmail: guestContactEmail,
			Subject:           subject,
			Status:            "open",
			CreatedAt:         now,
			UpdatedAt:         now,
		},
		Messages: []feedbackmodel.Message{
			{
				ID:         msgID,
				ThreadID:   threadID,
				AuthorRole: feedbackmodel.AuthorRoleUser,
				Body:       body,
				CreatedAt:  now,
			},
		},
	}, nil
}

// ListThreadsWithMessagesByUser returns this user's threads, newest first, each with messages oldest-first.
func (r *Repo) ListThreadsWithMessagesByUser(ctx context.Context, userID uuid.UUID) ([]feedbackmodel.ThreadWithMessages, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, guest_contact_email, subject, status, created_at, updated_at
		FROM feedback_threads
		WHERE user_id = $1
		ORDER BY updated_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("feedbackRepo.listThreads: %w", err)
	}
	defer rows.Close()

	var out []feedbackmodel.ThreadWithMessages
	for rows.Next() {
		t, err := scanThreadBase(rows)
		if err != nil {
			return nil, fmt.Errorf("feedbackRepo.listThreads scan: %w", err)
		}
		msgs, err := r.listMessagesForThread(ctx, t.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, feedbackmodel.ThreadWithMessages{Thread: t, Messages: msgs})
	}
	return out, rows.Err()
}

// AdminListThreadsWithMessages returns threads with submitter info for triage (users and guests).
func (r *Repo) AdminListThreadsWithMessages(ctx context.Context, limit int) ([]feedbackmodel.ThreadWithUser, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	rows, err := r.db.Query(ctx, `
		SELECT ft.id, ft.user_id, ft.guest_contact_email, ft.subject, ft.status, ft.created_at, ft.updated_at,
		       COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(ft.guest_contact_email), ''), ''),
		       COALESCE(NULLIF(TRIM(u.display_name), ''), 'Guest')
		FROM feedback_threads ft
		LEFT JOIN users u ON u.id = ft.user_id
		ORDER BY ft.updated_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("feedbackRepo.adminListThreads: %w", err)
	}
	defer rows.Close()

	var out []feedbackmodel.ThreadWithUser
	for rows.Next() {
		var tw feedbackmodel.ThreadWithUser
		var pgUID pgtype.UUID
		err := rows.Scan(
			&tw.Thread.ID,
			&pgUID,
			&tw.Thread.GuestContactEmail,
			&tw.Thread.Subject,
			&tw.Thread.Status,
			&tw.Thread.CreatedAt,
			&tw.Thread.UpdatedAt,
			&tw.UserEmail,
			&tw.UserDisplayName,
		)
		if err != nil {
			return nil, fmt.Errorf("feedbackRepo.adminListThreads scan: %w", err)
		}
		tw.Thread.UserID = uuidPtrFromPgUUID(pgUID)
		msgs, err := r.listMessagesForThread(ctx, tw.Thread.ID)
		if err != nil {
			return nil, err
		}
		tw.Messages = msgs
		out = append(out, tw)
	}
	return out, rows.Err()
}

func (r *Repo) listMessagesForThread(ctx context.Context, threadID uuid.UUID) ([]feedbackmodel.Message, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, thread_id, author_role, body, created_at
		FROM feedback_messages
		WHERE thread_id = $1
		ORDER BY created_at ASC
	`, threadID)
	if err != nil {
		return nil, fmt.Errorf("feedbackRepo.listMessages: %w", err)
	}
	defer rows.Close()

	var msgs []feedbackmodel.Message
	for rows.Next() {
		var m feedbackmodel.Message
		var role string
		if err := rows.Scan(&m.ID, &m.ThreadID, &role, &m.Body, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("feedbackRepo.listMessages scan: %w", err)
		}
		m.AuthorRole = feedbackmodel.AuthorRole(role)
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}

// AddMessage appends a message and bumps thread updated_at.
func (r *Repo) AddMessage(ctx context.Context, threadID uuid.UUID, role feedbackmodel.AuthorRole, body string) (*feedbackmodel.Message, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("feedbackRepo.AddMessage Begin: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	now := time.Now().UTC()
	msgID := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO feedback_messages (id, thread_id, author_role, body, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`, msgID, threadID, string(role), body, now); err != nil {
		return nil, fmt.Errorf("feedbackRepo.AddMessage insert: %w", err)
	}
	tag, err := tx.Exec(ctx, `
		UPDATE feedback_threads SET updated_at = $2 WHERE id = $1
	`, threadID, now)
	if err != nil {
		return nil, fmt.Errorf("feedbackRepo.AddMessage update thread: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, domainErr.ErrFeedbackThreadNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("feedbackRepo.AddMessage Commit: %w", err)
	}

	return &feedbackmodel.Message{
		ID:         msgID,
		ThreadID:   threadID,
		AuthorRole: role,
		Body:       body,
		CreatedAt:  now,
	}, nil
}

// DeleteThread removes a feedback thread; child messages cascade.
func (r *Repo) DeleteThread(ctx context.Context, threadID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM feedback_threads WHERE id = $1`, threadID)
	if err != nil {
		return fmt.Errorf("feedbackRepo.DeleteThread: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domainErr.ErrFeedbackThreadNotFound
	}
	return nil
}

// GetThreadUserID returns the owning user id for authorization checks (Nil UUID when guest thread).
func (r *Repo) GetThreadUserID(ctx context.Context, threadID uuid.UUID) (uuid.UUID, error) {
	var pgUID pgtype.UUID
	err := r.db.QueryRow(ctx, `SELECT user_id FROM feedback_threads WHERE id = $1`, threadID).Scan(&pgUID)
	if err != nil {
		return uuid.Nil, domainErr.ErrFeedbackThreadNotFound
	}
	if !pgUID.Valid {
		return uuid.Nil, nil
	}
	return uuid.UUID(pgUID.Bytes), nil
}
