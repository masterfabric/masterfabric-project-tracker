package notification

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/notification/model"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// NotificationRepo is the PostgreSQL implementation of NotificationRepository.
type NotificationRepo struct {
	db *pgxpool.Pool
}

// NewNotificationRepo creates a new NotificationRepo.
func NewNotificationRepo(db *pgxpool.Pool) *NotificationRepo {
	return &NotificationRepo{db: db}
}

const (
	sqlCreate = `
		INSERT INTO notifications (id, title, subtitle, message, type, category, icon, language, action_url, image_url, priority, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`

	sqlList = `
		SELECT id, title, subtitle, message, type, category, icon, language, action_url, image_url, priority, created_at, updated_at
		FROM notifications
		ORDER BY created_at DESC
		LIMIT $1`

	sqlListWithLanguage = `
		SELECT id, title, subtitle, message, type, category, icon, language, action_url, image_url, priority, created_at, updated_at
		FROM notifications
		WHERE (language IS NULL OR language = '' OR language = $1)
		ORDER BY created_at DESC
		LIMIT $2`

	sqlMarkRead = `
		INSERT INTO notification_reads (id, user_id, notification_id, read_at)
		VALUES (gen_random_uuid(), $1, $2, NOW())
		ON CONFLICT (user_id, notification_id) DO NOTHING`

	sqlGetReadIDs = `
		SELECT notification_id FROM notification_reads WHERE user_id = $1`

	sqlMarkAllReadForUser = `
		INSERT INTO notification_reads (id, user_id, notification_id, read_at)
		SELECT gen_random_uuid(), $1, n.id, NOW()
		FROM notifications n
		WHERE NOT EXISTS (
			SELECT 1 FROM notification_reads nr
			WHERE nr.user_id = $1 AND nr.notification_id = n.id
		)`

	sqlDeleteAll   = `DELETE FROM notifications`
	sqlDeleteByID  = `DELETE FROM notifications WHERE id = $1`

	sqlFindByID = `
		SELECT id, title, subtitle, message, type, category, icon, language, action_url, image_url, priority, created_at, updated_at
		FROM notifications WHERE id = $1`

	sqlUpdate = `
		UPDATE notifications SET
			title = $2, subtitle = $3, message = $4, type = $5, category = $6,
			icon = $7, language = $8, action_url = $9, image_url = $10, priority = $11, updated_at = $12
		WHERE id = $1`
)

// Create inserts a new notification.
func (r *NotificationRepo) Create(ctx context.Context, n *model.Notification) error {
	priority := n.Priority
	if priority == "" {
		priority = "normal"
	}
	_, err := r.db.Exec(ctx, sqlCreate,
		n.ID, n.Title, nullString(n.Subtitle), n.Message, string(n.Type), n.Category,
		nullString(n.Icon), nullString(n.Language), nullString(n.ActionURL), nullString(n.ImageURL),
		priority, n.CreatedAt, n.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("notificationRepo.Create: %w", err)
	}
	return nil
}

// List returns notifications, optionally filtered by language. Empty language means all.
func (r *NotificationRepo) List(ctx context.Context, limit int, language string) ([]*model.Notification, error) {
	if limit < 1 {
		limit = 100
	}
	var rows pgx.Rows
	var err error
	if language != "" {
		rows, err = r.db.Query(ctx, sqlListWithLanguage, language, limit)
	} else {
		rows, err = r.db.Query(ctx, sqlList, limit)
	}
	if err != nil {
		return nil, fmt.Errorf("notificationRepo.List: %w", err)
	}
	defer rows.Close()

	var result []*model.Notification
	for rows.Next() {
		n, err := scanNotification(rows)
		if err != nil {
			return nil, fmt.Errorf("notificationRepo.List scan: %w", err)
		}
		result = append(result, n)
	}
	return result, nil
}

// MarkRead marks a notification as read for a user.
func (r *NotificationRepo) MarkRead(ctx context.Context, userID, notificationID uuid.UUID) error {
	_, err := r.db.Exec(ctx, sqlMarkRead, userID, notificationID)
	if err != nil {
		return fmt.Errorf("notificationRepo.MarkRead: %w", err)
	}
	return nil
}

// MarkAllRead marks all given notifications as read for a user.
func (r *NotificationRepo) MarkAllRead(ctx context.Context, userID uuid.UUID, notificationIDs []uuid.UUID) error {
	if len(notificationIDs) == 0 {
		return nil
	}
	for _, nid := range notificationIDs {
		if err := r.MarkRead(ctx, userID, nid); err != nil {
			return err
		}
	}
	return nil
}

// MarkAllReadForUser marks all notifications as read for the user.
func (r *NotificationRepo) MarkAllReadForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, sqlMarkAllReadForUser, userID)
	if err != nil {
		return fmt.Errorf("notificationRepo.MarkAllReadForUser: %w", err)
	}
	return nil
}

// DeleteAll removes all notifications. notification_reads are cascade-deleted.
func (r *NotificationRepo) DeleteAll(ctx context.Context) error {
	_, err := r.db.Exec(ctx, sqlDeleteAll)
	if err != nil {
		return fmt.Errorf("notificationRepo.DeleteAll: %w", err)
	}
	return nil
}

// DeleteByID removes a single notification by ID. notification_reads are cascade-deleted.
func (r *NotificationRepo) DeleteByID(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, sqlDeleteByID, id)
	if err != nil {
		return fmt.Errorf("notificationRepo.DeleteByID: %w", err)
	}
	return nil
}

// FindByID returns a notification by ID or ErrNotFound.
func (r *NotificationRepo) FindByID(ctx context.Context, id uuid.UUID) (*model.Notification, error) {
	row := r.db.QueryRow(ctx, sqlFindByID, id)
	n, err := scanNotification(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domainErr.ErrNotificationNotFound
		}
		return nil, fmt.Errorf("notificationRepo.FindByID: %w", err)
	}
	return n, nil
}

// Update persists notification fields (full row).
func (r *NotificationRepo) Update(ctx context.Context, n *model.Notification) error {
	priority := n.Priority
	if priority == "" {
		priority = "normal"
	}
	tag, err := r.db.Exec(ctx, sqlUpdate,
		n.ID, n.Title, nullString(n.Subtitle), n.Message, string(n.Type), n.Category,
		nullString(n.Icon), nullString(n.Language), nullString(n.ActionURL), nullString(n.ImageURL),
		priority, n.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("notificationRepo.Update: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domainErr.ErrNotificationNotFound
	}
	return nil
}

// GetReadIDs returns the set of notification IDs the user has read.
func (r *NotificationRepo) GetReadIDs(ctx context.Context, userID uuid.UUID) (map[uuid.UUID]bool, error) {
	rows, err := r.db.Query(ctx, sqlGetReadIDs, userID)
	if err != nil {
		return nil, fmt.Errorf("notificationRepo.GetReadIDs: %w", err)
	}
	defer rows.Close()

	m := make(map[uuid.UUID]bool)
	for rows.Next() {
		var nid uuid.UUID
		if err := rows.Scan(&nid); err != nil {
			return nil, fmt.Errorf("notificationRepo.GetReadIDs scan: %w", err)
		}
		m[nid] = true
	}
	return m, nil
}

func scanNotification(row pgx.Row) (*model.Notification, error) {
	var n model.Notification
	var icon, lang, subtitle, actionURL, imageURL, priority *string
	err := row.Scan(&n.ID, &n.Title, &subtitle, &n.Message, (*string)(&n.Type), &n.Category,
		&icon, &lang, &actionURL, &imageURL, &priority, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if icon != nil {
		n.Icon = *icon
	}
	if lang != nil {
		n.Language = *lang
	}
	if subtitle != nil {
		n.Subtitle = *subtitle
	}
	if actionURL != nil {
		n.ActionURL = *actionURL
	}
	if imageURL != nil {
		n.ImageURL = *imageURL
	}
	if priority != nil {
		n.Priority = *priority
	}
	return &n, nil
}

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
