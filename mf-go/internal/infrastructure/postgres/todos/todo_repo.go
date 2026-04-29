package todos

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/model"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

// TodoRepo is the PostgreSQL implementation of domain TodoRepository.
type TodoRepo struct {
	db *pgxpool.Pool
}

// NewTodoRepo creates a new TodoRepo.
func NewTodoRepo(db *pgxpool.Pool) *TodoRepo {
	return &TodoRepo{db: db}
}

const (
	sqlCreateTodo = `
		INSERT INTO user_todos (id, user_id, title, completed, organization_id, assigned_to_user_id, due_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	// Org-linked todos require active membership (passive/suspended members see only personal rows).
	sqlActiveOrgIDsForUser = `
		SELECT organization_id FROM organization_members
		WHERE user_id = $1 AND membership_status = 'active'`

	sqlListTodosByUserID = `
		SELECT id, user_id, title, completed, archived_at, organization_id, assigned_to_user_id, due_at, created_at, updated_at
		FROM user_todos
		WHERE
		  archived_at IS NULL
		  AND (
		    (user_id = $1 AND (organization_id IS NULL OR organization_id IN (` + sqlActiveOrgIDsForUser + `)))
		    OR (assigned_to_user_id = $1 AND (organization_id IS NULL OR organization_id IN (` + sqlActiveOrgIDsForUser + `)))
		    OR (organization_id IS NOT NULL AND organization_id IN (` + sqlActiveOrgIDsForUser + `))
		  )
		ORDER BY created_at DESC`

	sqlListOwnedTodosByUserID = `
		SELECT id, user_id, title, completed, archived_at, organization_id, assigned_to_user_id, due_at, created_at, updated_at
		FROM user_todos
		WHERE user_id = $1
		  AND archived_at IS NULL
		  AND (organization_id IS NULL OR organization_id IN (` + sqlActiveOrgIDsForUser + `))
		ORDER BY created_at DESC`

	sqlListArchivedTodosByUserID = `
		SELECT id, user_id, title, completed, archived_at, organization_id, assigned_to_user_id, due_at, created_at, updated_at
		FROM user_todos
		WHERE user_id = $1
		  AND archived_at IS NOT NULL
		  AND (organization_id IS NULL OR organization_id IN (` + sqlActiveOrgIDsForUser + `))
		ORDER BY archived_at DESC, created_at DESC`

	sqlAdminGetTodoByID = `
		SELECT id, user_id, title, completed, archived_at, organization_id, assigned_to_user_id, due_at, created_at, updated_at
		FROM user_todos WHERE id = $1`

	sqlAdminUpdateTodo = `
		UPDATE user_todos
		SET title = $2, completed = $3, organization_id = $4, assigned_to_user_id = $5, due_at = $6, updated_at = $7
		WHERE id = $1`

	sqlAdminDeleteTodoByID = `DELETE FROM user_todos WHERE id = $1`

	sqlGetTodoByID = `
		SELECT id, user_id, title, completed, archived_at, organization_id, assigned_to_user_id, due_at, created_at, updated_at
		FROM user_todos
		WHERE id = $1 AND (
			archived_at IS NULL AND (
			(user_id = $2 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			)))
			OR (assigned_to_user_id = $2 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			)))
			OR (organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			))
			)
		)`

	sqlUpdateTodo = `
		UPDATE user_todos
		SET title = $2, completed = $3, organization_id = $4, assigned_to_user_id = $5, due_at = $6, updated_at = $7
		WHERE id = $1 AND (
			(user_id = $8 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $8 AND membership_status = 'active'
			)))
			OR (assigned_to_user_id = $8 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $8 AND membership_status = 'active'
			)))
			OR (organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $8 AND membership_status = 'active'
			))
		)`

	sqlDeleteTodo = `
		DELETE FROM user_todos
		WHERE id = $1 AND (
			(user_id = $2 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			)))
			OR (assigned_to_user_id = $2 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			)))
			OR (organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			))
		)`

	sqlArchiveTodo = `
		UPDATE user_todos
		SET archived_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND archived_at IS NULL AND (
			(user_id = $2 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			)))
			OR (assigned_to_user_id = $2 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			)))
			OR (organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			))
		)`

	sqlUnarchiveTodo = `
		UPDATE user_todos
		SET archived_at = NULL, updated_at = NOW()
		WHERE id = $1 AND archived_at IS NOT NULL AND (
			(user_id = $2 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			)))
			OR (assigned_to_user_id = $2 AND (organization_id IS NULL OR organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			)))
			OR (organization_id IN (
				SELECT organization_id FROM organization_members WHERE user_id = $2 AND membership_status = 'active'
			))
		)`

	sqlListUserTodoSubtasks = `
		SELECT id, user_todo_id, title, completed, sort_order, created_at, updated_at
		FROM user_todo_subtasks
		WHERE user_todo_id = $1
		  AND EXISTS (
			SELECT 1 FROM user_todos ut
			WHERE ut.id = user_todo_subtasks.user_todo_id
			  AND ut.archived_at IS NULL
		  )
		ORDER BY sort_order ASC, created_at ASC`

	sqlGetUserTodoSubtaskByID = `
		SELECT id, user_todo_id, title, completed, sort_order, created_at, updated_at
		FROM user_todo_subtasks
		WHERE id = $1
		  AND EXISTS (
			SELECT 1 FROM user_todos ut
			WHERE ut.id = user_todo_subtasks.user_todo_id
			  AND ut.archived_at IS NULL
		  )`

	sqlCountUserTodoSubtasks = `
		SELECT COUNT(*)
		FROM user_todo_subtasks
		WHERE user_todo_id = $1
		  AND EXISTS (
			SELECT 1 FROM user_todos ut
			WHERE ut.id = user_todo_subtasks.user_todo_id
			  AND ut.archived_at IS NULL
		  )`

	sqlInsertUserTodoSubtask = `
		INSERT INTO user_todo_subtasks (id, user_todo_id, title, completed, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	sqlUpdateUserTodoSubtask = `
		UPDATE user_todo_subtasks SET title = $2, completed = $3, sort_order = $4, updated_at = $5 WHERE id = $1`

	sqlDeleteUserTodoSubtask = `DELETE FROM user_todo_subtasks WHERE id = $1 AND user_todo_id = $2`

	sqlNextUserTodoSubtaskSort = `
		SELECT COALESCE(MAX(sort_order), -1) + 1
		FROM user_todo_subtasks
		WHERE user_todo_id = $1
		  AND EXISTS (
			SELECT 1 FROM user_todos ut
			WHERE ut.id = user_todo_subtasks.user_todo_id
			  AND ut.archived_at IS NULL
		  )`
)

// Create inserts a new todo.
func (r *TodoRepo) Create(ctx context.Context, t *model.UserTodo) error {
	_, err := r.db.Exec(ctx, sqlCreateTodo,
		t.ID, t.UserID, t.Title, t.Completed, t.OrganizationID, t.AssignedToUserID, t.DueAt, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("todoRepo.Create: %w", err)
	}
	return nil
}

// ListByUserID returns all todos for the given user.
func (r *TodoRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*model.UserTodo, error) {
	rows, err := r.db.Query(ctx, sqlListTodosByUserID, userID)
	if err != nil {
		return nil, fmt.Errorf("todoRepo.ListByUserID: %w", err)
	}
	defer rows.Close()

	var results []*model.UserTodo
	for rows.Next() {
		t, err := scanTodo(rows)
		if err != nil {
			return nil, fmt.Errorf("todoRepo.ListByUserID scan: %w", err)
		}
		results = append(results, t)
	}

	return results, nil
}

// ListOwnedByUserID returns todos where user_id is the owner (creator).
func (r *TodoRepo) ListOwnedByUserID(ctx context.Context, userID uuid.UUID) ([]*model.UserTodo, error) {
	rows, err := r.db.Query(ctx, sqlListOwnedTodosByUserID, userID)
	if err != nil {
		return nil, fmt.Errorf("todoRepo.ListOwnedByUserID: %w", err)
	}
	defer rows.Close()

	var results []*model.UserTodo
	for rows.Next() {
		t, err := scanTodo(rows)
		if err != nil {
			return nil, fmt.Errorf("todoRepo.ListOwnedByUserID scan: %w", err)
		}
		results = append(results, t)
	}
	return results, rows.Err()
}

// ListArchivedByUserID returns archived todos owned by user_id (creator).
func (r *TodoRepo) ListArchivedByUserID(ctx context.Context, userID uuid.UUID) ([]*model.UserTodo, error) {
	rows, err := r.db.Query(ctx, sqlListArchivedTodosByUserID, userID)
	if err != nil {
		return nil, fmt.Errorf("todoRepo.ListArchivedByUserID: %w", err)
	}
	defer rows.Close()
	var results []*model.UserTodo
	for rows.Next() {
		t, err := scanTodo(rows)
		if err != nil {
			return nil, fmt.Errorf("todoRepo.ListArchivedByUserID scan: %w", err)
		}
		results = append(results, t)
	}
	return results, rows.Err()
}

// AdminGetByID returns a todo by primary key (admin; no membership check).
func (r *TodoRepo) AdminGetByID(ctx context.Context, id uuid.UUID) (*model.UserTodo, error) {
	row := r.db.QueryRow(ctx, sqlAdminGetTodoByID, id)
	t, err := scanTodo(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("todoRepo.AdminGetByID: %w", err)
	}
	return t, nil
}

// AdminUpdateTodo updates a todo row by id (admin).
func (r *TodoRepo) AdminUpdateTodo(ctx context.Context, t *model.UserTodo) error {
	tag, err := r.db.Exec(ctx, sqlAdminUpdateTodo,
		t.ID, t.Title, t.Completed, t.OrganizationID, t.AssignedToUserID, t.DueAt, t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("todoRepo.AdminUpdateTodo: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("todoRepo.AdminUpdateTodo: todo not found")
	}
	return nil
}

// AdminDeleteByID deletes a todo by id (admin).
func (r *TodoRepo) AdminDeleteByID(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, sqlAdminDeleteTodoByID, id)
	if err != nil {
		return fmt.Errorf("todoRepo.AdminDeleteByID: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("todoRepo.AdminDeleteByID: todo not found")
	}
	return nil
}

// GetByID returns a todo by ID for the given user.
func (r *TodoRepo) GetByID(ctx context.Context, id, userID uuid.UUID) (*model.UserTodo, error) {
	row := r.db.QueryRow(ctx, sqlGetTodoByID, id, userID)
	t, err := scanTodo(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("todoRepo.GetByID: %w", err)
	}
	return t, nil
}

// Update updates a todo (caller must have access: creator, assignee, or org member).
func (r *TodoRepo) Update(ctx context.Context, t *model.UserTodo, actorUserID uuid.UUID) error {
	result, err := r.db.Exec(ctx, sqlUpdateTodo,
		t.ID, t.Title, t.Completed, t.OrganizationID, t.AssignedToUserID, t.DueAt, t.UpdatedAt, actorUserID,
	)
	if err != nil {
		return fmt.Errorf("todoRepo.Update: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("todoRepo.Update: todo not found")
	}
	return nil
}

// Delete removes a todo.
func (r *TodoRepo) Delete(ctx context.Context, id, userID uuid.UUID) error {
	result, err := r.db.Exec(ctx, sqlDeleteTodo, id, userID)
	if err != nil {
		return fmt.Errorf("todoRepo.Delete: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("todoRepo.Delete: %w", domainErr.ErrTodoNotFound)
	}
	return nil
}

// ArchiveByID soft-archives a todo visible to user.
func (r *TodoRepo) ArchiveByID(ctx context.Context, id, userID uuid.UUID) error {
	result, err := r.db.Exec(ctx, sqlArchiveTodo, id, userID)
	if err != nil {
		return fmt.Errorf("todoRepo.ArchiveByID: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("todoRepo.ArchiveByID: %w", domainErr.ErrTodoNotFound)
	}
	return nil
}

// UnarchiveByID restores an archived todo visible to user.
func (r *TodoRepo) UnarchiveByID(ctx context.Context, id, userID uuid.UUID) error {
	result, err := r.db.Exec(ctx, sqlUnarchiveTodo, id, userID)
	if err != nil {
		return fmt.Errorf("todoRepo.UnarchiveByID: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("todoRepo.UnarchiveByID: %w", domainErr.ErrTodoNotFound)
	}
	return nil
}

func scanTodo(row pgx.Row) (*model.UserTodo, error) {
	var t model.UserTodo
	var archivedAt sql.NullTime
	var dueAt sql.NullTime
	err := row.Scan(
		&t.ID, &t.UserID, &t.Title, &t.Completed, &archivedAt,
		&t.OrganizationID, &t.AssignedToUserID,
		&dueAt,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if dueAt.Valid {
		u := dueAt.Time.UTC()
		t.DueAt = &u
	}
	if archivedAt.Valid {
		u := archivedAt.Time.UTC()
		t.ArchivedAt = &u
	}
	return &t, nil
}

// ListUserTodoSubtasksByUserTodoID returns subtasks ordered for display.
func (r *TodoRepo) ListUserTodoSubtasksByUserTodoID(ctx context.Context, userTodoID uuid.UUID) ([]*model.UserTodoSubtask, error) {
	rows, err := r.db.Query(ctx, sqlListUserTodoSubtasks, userTodoID)
	if err != nil {
		return nil, fmt.Errorf("todoRepo.ListUserTodoSubtasksByUserTodoID: %w", err)
	}
	defer rows.Close()
	var out []*model.UserTodoSubtask
	for rows.Next() {
		s, err := scanUserTodoSubtask(rows)
		if err != nil {
			return nil, fmt.Errorf("todoRepo.ListUserTodoSubtasksByUserTodoID scan: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// GetUserTodoSubtaskByID returns a subtask or nil.
func (r *TodoRepo) GetUserTodoSubtaskByID(ctx context.Context, id uuid.UUID) (*model.UserTodoSubtask, error) {
	row := r.db.QueryRow(ctx, sqlGetUserTodoSubtaskByID, id)
	s, err := scanUserTodoSubtask(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("todoRepo.GetUserTodoSubtaskByID: %w", err)
	}
	return s, nil
}

// CountUserTodoSubtasksByUserTodoID returns how many subtasks exist for a parent todo.
func (r *TodoRepo) CountUserTodoSubtasksByUserTodoID(ctx context.Context, userTodoID uuid.UUID) (int, error) {
	var n int
	if err := r.db.QueryRow(ctx, sqlCountUserTodoSubtasks, userTodoID).Scan(&n); err != nil {
		return 0, fmt.Errorf("todoRepo.CountUserTodoSubtasksByUserTodoID: %w", err)
	}
	return n, nil
}

// NextUserTodoSubtaskSortOrder returns the next sort_order for a new subtask under parent.
func (r *TodoRepo) NextUserTodoSubtaskSortOrder(ctx context.Context, userTodoID uuid.UUID) (int, error) {
	var n int
	if err := r.db.QueryRow(ctx, sqlNextUserTodoSubtaskSort, userTodoID).Scan(&n); err != nil {
		return 0, fmt.Errorf("todoRepo.NextUserTodoSubtaskSortOrder: %w", err)
	}
	return n, nil
}

// CreateUserTodoSubtask inserts a subtask row.
func (r *TodoRepo) CreateUserTodoSubtask(ctx context.Context, s *model.UserTodoSubtask) error {
	_, err := r.db.Exec(ctx, sqlInsertUserTodoSubtask,
		s.ID, s.UserTodoID, s.Title, s.Completed, s.SortOrder, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("todoRepo.CreateUserTodoSubtask: %w", err)
	}
	return nil
}

// UpdateUserTodoSubtask updates title, completed, sort_order.
func (r *TodoRepo) UpdateUserTodoSubtask(ctx context.Context, s *model.UserTodoSubtask) error {
	tag, err := r.db.Exec(ctx, sqlUpdateUserTodoSubtask, s.ID, s.Title, s.Completed, s.SortOrder, s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("todoRepo.UpdateUserTodoSubtask: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("todoRepo.UpdateUserTodoSubtask: not found")
	}
	return nil
}

// DeleteUserTodoSubtask deletes by id and parent todo id.
func (r *TodoRepo) DeleteUserTodoSubtask(ctx context.Context, id, userTodoID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, sqlDeleteUserTodoSubtask, id, userTodoID)
	if err != nil {
		return fmt.Errorf("todoRepo.DeleteUserTodoSubtask: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("todoRepo.DeleteUserTodoSubtask: not found")
	}
	return nil
}

func scanUserTodoSubtask(row pgx.Row) (*model.UserTodoSubtask, error) {
	var s model.UserTodoSubtask
	err := row.Scan(&s.ID, &s.UserTodoID, &s.Title, &s.Completed, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}
