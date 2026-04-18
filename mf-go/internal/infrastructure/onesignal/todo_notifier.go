package onesignal

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/push"
	iamRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	orgmodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
	settingsRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/settings/repository"
	todomodel "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/model"
	infraRedis "github.com/masterfabric/masterfabric_go_basic/internal/infrastructure/redis"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// TodoNotifier implements push.TodoOneSignal using the REST client + Redis for scheduled ids.
type TodoNotifier struct {
	client    *Client
	cache     *infraRedis.CacheHandler
	keyPrefix string
	settings  settingsRepo.UserSettingsRepository
	users     iamRepo.UserRepository
	log       *slog.Logger
	minLead   time.Duration
}

// NewTodoNotifier returns a notifier. client may be nil or disabled (no REST key) — methods no-op.
func NewTodoNotifier(
	client *Client,
	cache *infraRedis.CacheHandler,
	keyPrefix string,
	settings settingsRepo.UserSettingsRepository,
	users iamRepo.UserRepository,
	log *slog.Logger,
) push.TodoOneSignal {
	if client == nil || !client.Enabled() {
		return nil
	}
	return &TodoNotifier{
		client:    client,
		cache:     cache,
		keyPrefix: keyPrefix,
		settings:  settings,
		users:     users,
		log:       log,
		minLead:   45 * time.Second,
	}
}

func (n *TodoNotifier) UserTodoSaved(ctx context.Context, before, after *todomodel.UserTodo, actor uuid.UUID) {
	if n == nil || after == nil {
		return
	}
	go n.run(context.Background(), func(ctx context.Context) {
		n.syncUserTodo(ctx, before, after, actor)
	})
}

func (n *TodoNotifier) UserTodoDeleting(ctx context.Context, todoID uuid.UUID) {
	if n == nil {
		return
	}
	go n.run(context.Background(), func(ctx context.Context) {
		n.cancelScheduledUserTodo(ctx, todoID)
	})
}

func (n *TodoNotifier) OrgProjectTodoSaved(ctx context.Context, before, after *orgmodel.OrganizationProjectTodo, actor uuid.UUID) {
	if n == nil || after == nil {
		return
	}
	go n.run(context.Background(), func(ctx context.Context) {
		n.syncOrgProjectTodo(ctx, before, after, actor)
	})
}

func (n *TodoNotifier) OrgProjectTodoDeleting(ctx context.Context, todoID uuid.UUID) {
	if n == nil {
		return
	}
	go n.run(context.Background(), func(ctx context.Context) {
		n.cancelScheduledOrgProjectTodo(ctx, todoID)
	})
}

func (n *TodoNotifier) run(ctx context.Context, fn func(context.Context)) {
	cctx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	fn(cctx)
}

func (n *TodoNotifier) recipientAllowsPush(ctx context.Context, userID uuid.UUID) bool {
	s, err := n.settings.FindByUserID(ctx, userID)
	if err != nil {
		if domainErr.Is(err, domainErr.ErrSettingsNotFound) {
			return true
		}
		if n.log != nil {
			n.log.Debug("todo push: settings lookup failed", slog.String("user_id", userID.String()), slog.Any("error", err))
		}
		return true
	}
	return s.NotificationsOn
}

func (n *TodoNotifier) actorDisplayName(ctx context.Context, actor uuid.UUID) string {
	u, err := n.users.FindByID(ctx, actor)
	if err != nil || u == nil {
		return ""
	}
	if u.Nickname != "" {
		return u.Nickname
	}
	if u.DisplayName != "" {
		return u.DisplayName
	}
	if u.Email != "" {
		return u.Email
	}
	return ""
}

func (n *TodoNotifier) syncUserTodo(ctx context.Context, before, after *todomodel.UserTodo, actor uuid.UUID) {
	// Assignment → notify assignee when newly set or changed
	if after.AssignedToUserID != nil {
		if before == nil || !uuidPtrEqual(before.AssignedToUserID, after.AssignedToUserID) {
			assignee := *after.AssignedToUserID
			if n.recipientAllowsPush(ctx, assignee) {
				name := n.actorDisplayName(ctx, actor)
				titleEn, titleTr, bodyEn, bodyTr := assignmentCopy(name, after.Title, false)
				_, _ = n.client.CreateNotification(ctx, CreateNotificationInput{
					ExternalIDs: []string{assignee.String()},
					Headings:    map[string]string{"en": titleEn, "tr": titleTr},
					Contents:    map[string]string{"en": bodyEn, "tr": bodyTr},
					Data: map[string]interface{}{
						"type":            "todo_assigned",
						"todo_id":         after.ID.String(),
						"category":        "todo",
						"notification_id": "mf-todo-assigned-" + after.ID.String(),
					},
				})
			}
		}
	}

	// Due reminder
	n.cancelScheduledUserTodo(ctx, after.ID)
	if shouldScheduleUserTodoDue(after, time.Now().UTC(), n.minLead) {
		recipient := userTodoDueRecipient(after)
		if recipient == nil || !n.recipientAllowsPush(ctx, *recipient) {
			return
		}
		due := after.DueAt.UTC()
		notifID, err := n.client.CreateNotification(ctx, CreateNotificationInput{
			ExternalIDs: []string{recipient.String()},
			Headings:    map[string]string{"en": "Task due", "tr": "Görev zamanı"},
			Contents: map[string]string{
				"en": after.Title,
				"tr": after.Title,
			},
			Data: map[string]interface{}{
				"type":            "todo_due",
				"todo_id":         after.ID.String(),
				"category":        "todo",
				"notification_id": "mf-todo-due-" + after.ID.String(),
			},
			SendAfterUTC: &due,
			CollapseID:   "mf-todo-due-" + after.ID.String(),
		})
		if err != nil && n.log != nil {
			n.log.Warn("todo due schedule failed", slog.String("todo_id", after.ID.String()), slog.Any("error", err))
			return
		}
		if notifID != "" && n.cache != nil && n.cache.Available() {
			ttl := time.Until(due) + 72*time.Hour
			if ttl < time.Hour {
				ttl = time.Hour
			}
			_ = n.cache.Set(ctx, infraRedis.OneSignalScheduledUserTodoKey(n.keyPrefix, after.ID.String()), notifID, ttl)
		}
	}
}

func (n *TodoNotifier) cancelScheduledUserTodo(ctx context.Context, todoID uuid.UUID) {
	if n.cache == nil || !n.cache.Available() {
		return
	}
	key := infraRedis.OneSignalScheduledUserTodoKey(n.keyPrefix, todoID.String())
	oldID, ok, err := n.cache.GetDel(ctx, key)
	if err != nil || !ok || oldID == "" {
		return
	}
	_ = n.client.CancelNotification(ctx, oldID)
}

func (n *TodoNotifier) syncOrgProjectTodo(ctx context.Context, before, after *orgmodel.OrganizationProjectTodo, actor uuid.UUID) {
	if after.AssignedToUserID != nil {
		if before == nil || !uuidPtrEqual(before.AssignedToUserID, after.AssignedToUserID) {
			assignee := *after.AssignedToUserID
			if n.recipientAllowsPush(ctx, assignee) {
				name := n.actorDisplayName(ctx, actor)
				titleEn, titleTr, bodyEn, bodyTr := assignmentCopy(name, after.Title, true)
				_, _ = n.client.CreateNotification(ctx, CreateNotificationInput{
					ExternalIDs: []string{assignee.String()},
					Headings:    map[string]string{"en": titleEn, "tr": titleTr},
					Contents:    map[string]string{"en": bodyEn, "tr": bodyTr},
					Data: map[string]interface{}{
						"type":            "todo_assigned",
						"todo_id":         after.ID.String(),
						"category":        "project_todo",
						"notification_id": "mf-project-todo-assigned-" + after.ID.String(),
					},
				})
			}
		}
	}

	n.cancelScheduledOrgProjectTodo(ctx, after.ID)
	if shouldScheduleOrgProjectTodoDue(after, time.Now().UTC(), n.minLead) {
		recipient := orgProjectTodoDueRecipient(after)
		if recipient == nil || !n.recipientAllowsPush(ctx, *recipient) {
			return
		}
		due := after.DueAt.UTC()
		notifID, err := n.client.CreateNotification(ctx, CreateNotificationInput{
			ExternalIDs: []string{recipient.String()},
			Headings:    map[string]string{"en": "Task due", "tr": "Görev zamanı"},
			Contents: map[string]string{
				"en": after.Title,
				"tr": after.Title,
			},
			Data: map[string]interface{}{
				"type":            "todo_due",
				"todo_id":         after.ID.String(),
				"category":        "project_todo",
				"notification_id": "mf-todo-due-" + after.ID.String(),
			},
			SendAfterUTC: &due,
			CollapseID:   "mf-todo-due-" + after.ID.String(),
		})
		if err != nil && n.log != nil {
			n.log.Warn("project todo due schedule failed", slog.String("todo_id", after.ID.String()), slog.Any("error", err))
			return
		}
		if notifID != "" && n.cache != nil && n.cache.Available() {
			ttl := time.Until(due) + 72*time.Hour
			if ttl < time.Hour {
				ttl = time.Hour
			}
			_ = n.cache.Set(ctx, infraRedis.OneSignalScheduledOrgProjectTodoKey(n.keyPrefix, after.ID.String()), notifID, ttl)
		}
	}
}

func (n *TodoNotifier) cancelScheduledOrgProjectTodo(ctx context.Context, todoID uuid.UUID) {
	if n.cache == nil || !n.cache.Available() {
		return
	}
	key := infraRedis.OneSignalScheduledOrgProjectTodoKey(n.keyPrefix, todoID.String())
	oldID, ok, err := n.cache.GetDel(ctx, key)
	if err != nil || !ok || oldID == "" {
		return
	}
	_ = n.client.CancelNotification(ctx, oldID)
}

func assignmentCopy(actorName, todoTitle string, project bool) (titleEn, titleTr, bodyEn, bodyTr string) {
	who := actorName
	if who == "" {
		whoEn := "Someone"
		whoTr := "Birisi"
		if project {
			titleEn = "New project task"
			titleTr = "Yeni proje görevi"
			bodyEn = whoEn + " assigned you: " + todoTitle
			bodyTr = whoTr + " size atadı: " + todoTitle
			return titleEn, titleTr, bodyEn, bodyTr
		}
		titleEn = "New task"
		titleTr = "Yeni görev"
		bodyEn = whoEn + " assigned you: " + todoTitle
		bodyTr = whoTr + " size atadı: " + todoTitle
		return titleEn, titleTr, bodyEn, bodyTr
	}
	if project {
		titleEn = "New project task"
		titleTr = "Yeni proje görevi"
		bodyEn = actorName + " assigned you: " + todoTitle
		bodyTr = actorName + " size atadı: " + todoTitle
		return titleEn, titleTr, bodyEn, bodyTr
	}
	titleEn = "New task"
	titleTr = "Yeni görev"
	bodyEn = actorName + " assigned you: " + todoTitle
	bodyTr = actorName + " size atadı: " + todoTitle
	return titleEn, titleTr, bodyEn, bodyTr
}

func userTodoDueRecipient(t *todomodel.UserTodo) *uuid.UUID {
	if t.AssignedToUserID != nil {
		return t.AssignedToUserID
	}
	return &t.UserID
}

func orgProjectTodoDueRecipient(t *orgmodel.OrganizationProjectTodo) *uuid.UUID {
	if t.AssignedToUserID != nil {
		return t.AssignedToUserID
	}
	return &t.CreatedByUserID
}

func shouldScheduleUserTodoDue(t *todomodel.UserTodo, now time.Time, minLead time.Duration) bool {
	if t.Completed || t.DueAt == nil {
		return false
	}
	return t.DueAt.UTC().After(now.Add(minLead))
}

func shouldScheduleOrgProjectTodoDue(t *orgmodel.OrganizationProjectTodo, now time.Time, minLead time.Duration) bool {
	if t.Status == orgmodel.OrganizationProjectTodoDone || t.DueAt == nil {
		return false
	}
	return t.DueAt.UTC().After(now.Add(minLead))
}

func uuidPtrEqual(a, b *uuid.UUID) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}
