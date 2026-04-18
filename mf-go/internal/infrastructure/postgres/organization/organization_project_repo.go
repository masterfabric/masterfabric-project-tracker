package organization

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
)

const (
	sqlGetOrgProjectByID = `
		SELECT id, organization_id, name, description, created_by_user_id, created_at, updated_at
		FROM organization_projects WHERE id = $1`

	sqlListOrgProjectsByOrg = `
		SELECT id, organization_id, name, description, created_by_user_id, created_at, updated_at
		FROM organization_projects WHERE organization_id = $1
		ORDER BY created_at DESC`

	sqlListOrgProjectsForMember = `
		SELECT p.id, p.organization_id, p.name, p.description, p.created_by_user_id, p.created_at, p.updated_at
		FROM organization_projects p
		INNER JOIN organization_project_members m ON m.project_id = p.id AND m.user_id = $2
		WHERE p.organization_id = $1
		ORDER BY p.created_at DESC`

	sqlInsertOrgProject = `
		INSERT INTO organization_projects (id, organization_id, name, description, created_by_user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	sqlUpdateOrgProject = `
		UPDATE organization_projects
		SET name = $2, description = $3, updated_at = $4
		WHERE id = $1`

	sqlDeleteOrgProject = `DELETE FROM organization_projects WHERE id = $1`

	sqlInsertProjectMember = `
		INSERT INTO organization_project_members (id, project_id, user_id, added_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (project_id, user_id) DO NOTHING`

	sqlRemoveProjectMember = `
		DELETE FROM organization_project_members WHERE project_id = $1 AND user_id = $2`

	sqlListProjectMembers = `
		SELECT id, project_id, user_id, added_at
		FROM organization_project_members WHERE project_id = $1
		ORDER BY added_at ASC`

	sqlIsProjectMember = `
		SELECT 1 FROM organization_project_members
		WHERE project_id = $1 AND user_id = $2 LIMIT 1`

	sqlListProjectTodos = `
		SELECT id, project_id, title, status, created_by_user_id, assigned_to_user_id, due_at, created_at, updated_at
		FROM organization_project_todos WHERE project_id = $1
		ORDER BY created_at DESC`

	sqlGetProjectTodoByID = `
		SELECT id, project_id, title, status, created_by_user_id, assigned_to_user_id, due_at, created_at, updated_at
		FROM organization_project_todos WHERE id = $1`

	sqlInsertProjectTodo = `
		INSERT INTO organization_project_todos (id, project_id, title, status, created_by_user_id, assigned_to_user_id, due_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

	sqlUpdateProjectTodo = `
		UPDATE organization_project_todos
		SET title = $2, status = $3, due_at = $4, updated_at = $5
		WHERE id = $1`

	sqlDeleteProjectTodo = `DELETE FROM organization_project_todos WHERE id = $1`

	sqlListProjectTodoSubtasks = `
		SELECT id, project_todo_id, title, completed, sort_order, created_at, updated_at
		FROM organization_project_todo_subtasks WHERE project_todo_id = $1
		ORDER BY sort_order ASC, created_at ASC`

	sqlGetProjectTodoSubtaskByID = `
		SELECT id, project_todo_id, title, completed, sort_order, created_at, updated_at
		FROM organization_project_todo_subtasks WHERE id = $1`

	sqlCountProjectTodoSubtasks = `
		SELECT COUNT(*) FROM organization_project_todo_subtasks WHERE project_todo_id = $1`

	sqlNextProjectTodoSubtaskSort = `
		SELECT COALESCE(MAX(sort_order), -1) + 1 FROM organization_project_todo_subtasks WHERE project_todo_id = $1`

	sqlInsertProjectTodoSubtask = `
		INSERT INTO organization_project_todo_subtasks (id, project_todo_id, title, completed, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`

	sqlUpdateProjectTodoSubtask = `
		UPDATE organization_project_todo_subtasks
		SET title = $2, completed = $3, sort_order = $4, updated_at = $5 WHERE id = $1`

	sqlDeleteProjectTodoSubtask = `DELETE FROM organization_project_todo_subtasks WHERE id = $1 AND project_todo_id = $2`

	sqlListProjectPurchases = `
		SELECT id, project_id, product_name, tax_rate, product_purpose, price, quantity, product_link,
		       status, status_note, currency, created_by_user_id, created_at, updated_at
		FROM organization_project_purchases WHERE project_id = $1
		ORDER BY created_at DESC`

	sqlGetProjectPurchaseByID = `
		SELECT id, project_id, product_name, tax_rate, product_purpose, price, quantity, product_link,
		       status, status_note, currency, created_by_user_id, created_at, updated_at
		FROM organization_project_purchases WHERE id = $1`

	sqlInsertProjectPurchase = `
		INSERT INTO organization_project_purchases (
			id, project_id, product_name, tax_rate, product_purpose, price, quantity, product_link,
			status, status_note, currency, created_by_user_id, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`

	sqlUpdateProjectPurchase = `
		UPDATE organization_project_purchases
		SET product_name = $2, tax_rate = $3, product_purpose = $4, price = $5, quantity = $6,
		    product_link = $7, status = $8, status_note = $9, currency = $10, updated_at = $11
		WHERE id = $1`

	sqlDeleteProjectPurchase = `DELETE FROM organization_project_purchases WHERE id = $1`
)

// GetOrganizationProjectByID returns a project or nil.
func (r *OrganizationRepo) GetOrganizationProjectByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProject, error) {
	row := r.db.QueryRow(ctx, sqlGetOrgProjectByID, id)
	p, err := scanOrganizationProject(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetOrganizationProjectByID: %w", err)
	}
	return p, nil
}

// ListOrganizationProjectsByOrgID lists projects in an organization.
func (r *OrganizationRepo) ListOrganizationProjectsByOrgID(ctx context.Context, orgID uuid.UUID) ([]*model.OrganizationProject, error) {
	rows, err := r.db.Query(ctx, sqlListOrgProjectsByOrg, orgID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListOrganizationProjectsByOrgID: %w", err)
	}
	defer rows.Close()

	var out []*model.OrganizationProject
	for rows.Next() {
		p, err := scanOrganizationProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// ListOrganizationProjectsForOrgMember returns projects the user is assigned to in the org.
func (r *OrganizationRepo) ListOrganizationProjectsForOrgMember(ctx context.Context, orgID, userID uuid.UUID) ([]*model.OrganizationProject, error) {
	rows, err := r.db.Query(ctx, sqlListOrgProjectsForMember, orgID, userID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListOrganizationProjectsForOrgMember: %w", err)
	}
	defer rows.Close()

	var out []*model.OrganizationProject
	for rows.Next() {
		p, err := scanOrganizationProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// CreateOrganizationProject inserts a project row.
func (r *OrganizationRepo) CreateOrganizationProject(ctx context.Context, p *model.OrganizationProject) error {
	_, err := r.db.Exec(ctx, sqlInsertOrgProject,
		p.ID, p.OrganizationID, p.Name, p.Description, p.CreatedByUserID, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.CreateOrganizationProject: %w", err)
	}
	return nil
}

// UpdateOrganizationProject updates name/description.
func (r *OrganizationRepo) UpdateOrganizationProject(ctx context.Context, p *model.OrganizationProject) error {
	res, err := r.db.Exec(ctx, sqlUpdateOrgProject, p.ID, p.Name, p.Description, p.UpdatedAt)
	if err != nil {
		return fmt.Errorf("organizationRepo.UpdateOrganizationProject: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.UpdateOrganizationProject: not found")
	}
	return nil
}

// DeleteOrganizationProject deletes a project (cascades members and todos).
func (r *OrganizationRepo) DeleteOrganizationProject(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.Exec(ctx, sqlDeleteOrgProject, id)
	if err != nil {
		return fmt.Errorf("organizationRepo.DeleteOrganizationProject: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.DeleteOrganizationProject: not found")
	}
	return nil
}

// AddOrganizationProjectMember adds a user to the project roster.
func (r *OrganizationRepo) AddOrganizationProjectMember(ctx context.Context, m *model.OrganizationProjectMember) error {
	_, err := r.db.Exec(ctx, sqlInsertProjectMember, m.ID, m.ProjectID, m.UserID, m.AddedAt)
	if err != nil {
		return fmt.Errorf("organizationRepo.AddOrganizationProjectMember: %w", err)
	}
	return nil
}

// RemoveOrganizationProjectMember removes a user from the project.
func (r *OrganizationRepo) RemoveOrganizationProjectMember(ctx context.Context, projectID, userID uuid.UUID) error {
	res, err := r.db.Exec(ctx, sqlRemoveProjectMember, projectID, userID)
	if err != nil {
		return fmt.Errorf("organizationRepo.RemoveOrganizationProjectMember: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.RemoveOrganizationProjectMember: not found")
	}
	return nil
}

// ListOrganizationProjectMembers lists roster rows for a project.
func (r *OrganizationRepo) ListOrganizationProjectMembers(ctx context.Context, projectID uuid.UUID) ([]*model.OrganizationProjectMember, error) {
	rows, err := r.db.Query(ctx, sqlListProjectMembers, projectID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListOrganizationProjectMembers: %w", err)
	}
	defer rows.Close()

	var out []*model.OrganizationProjectMember
	for rows.Next() {
		m, err := scanOrganizationProjectMember(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, nil
}

// IsOrganizationProjectMember is true if the user is on the project roster.
func (r *OrganizationRepo) IsOrganizationProjectMember(ctx context.Context, projectID, userID uuid.UUID) (bool, error) {
	var x int
	err := r.db.QueryRow(ctx, sqlIsProjectMember, projectID, userID).Scan(&x)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, nil
		}
		return false, fmt.Errorf("organizationRepo.IsOrganizationProjectMember: %w", err)
	}
	return true, nil
}

// ListOrganizationProjectTodos lists todos for a project (newest first).
func (r *OrganizationRepo) ListOrganizationProjectTodos(ctx context.Context, projectID uuid.UUID) ([]*model.OrganizationProjectTodo, error) {
	rows, err := r.db.Query(ctx, sqlListProjectTodos, projectID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListOrganizationProjectTodos: %w", err)
	}
	defer rows.Close()

	var out []*model.OrganizationProjectTodo
	for rows.Next() {
		t, err := scanOrganizationProjectTodo(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, nil
}

// GetOrganizationProjectTodoByID returns a todo or nil.
func (r *OrganizationRepo) GetOrganizationProjectTodoByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProjectTodo, error) {
	row := r.db.QueryRow(ctx, sqlGetProjectTodoByID, id)
	t, err := scanOrganizationProjectTodo(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetOrganizationProjectTodoByID: %w", err)
	}
	return t, nil
}

// CreateOrganizationProjectTodo inserts a todo.
func (r *OrganizationRepo) CreateOrganizationProjectTodo(ctx context.Context, t *model.OrganizationProjectTodo) error {
	assignee := pgtype.UUID{Valid: false}
	if t.AssignedToUserID != nil {
		assignee.Valid = true
		copy(assignee.Bytes[:], t.AssignedToUserID[:])
	}
	_, err := r.db.Exec(ctx, sqlInsertProjectTodo,
		t.ID, t.ProjectID, t.Title, string(t.Status), t.CreatedByUserID, assignee, t.DueAt, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.CreateOrganizationProjectTodo: %w", err)
	}
	return nil
}

// UpdateOrganizationProjectTodo updates title/status.
func (r *OrganizationRepo) UpdateOrganizationProjectTodo(ctx context.Context, t *model.OrganizationProjectTodo) error {
	res, err := r.db.Exec(ctx, sqlUpdateProjectTodo, t.ID, t.Title, string(t.Status), t.DueAt, t.UpdatedAt)
	if err != nil {
		return fmt.Errorf("organizationRepo.UpdateOrganizationProjectTodo: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.UpdateOrganizationProjectTodo: not found")
	}
	return nil
}

// DeleteOrganizationProjectTodo deletes a todo by id.
func (r *OrganizationRepo) DeleteOrganizationProjectTodo(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.Exec(ctx, sqlDeleteProjectTodo, id)
	if err != nil {
		return fmt.Errorf("organizationRepo.DeleteOrganizationProjectTodo: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.DeleteOrganizationProjectTodo: not found")
	}
	return nil
}

// ListOrganizationProjectTodoSubtasksByParentID returns subtasks for a project todo.
func (r *OrganizationRepo) ListOrganizationProjectTodoSubtasksByParentID(ctx context.Context, projectTodoID uuid.UUID) ([]*model.OrganizationProjectTodoSubtask, error) {
	rows, err := r.db.Query(ctx, sqlListProjectTodoSubtasks, projectTodoID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListOrganizationProjectTodoSubtasksByParentID: %w", err)
	}
	defer rows.Close()
	var out []*model.OrganizationProjectTodoSubtask
	for rows.Next() {
		s, err := scanOrganizationProjectTodoSubtask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// GetOrganizationProjectTodoSubtaskByID returns a subtask or nil.
func (r *OrganizationRepo) GetOrganizationProjectTodoSubtaskByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProjectTodoSubtask, error) {
	row := r.db.QueryRow(ctx, sqlGetProjectTodoSubtaskByID, id)
	s, err := scanOrganizationProjectTodoSubtask(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetOrganizationProjectTodoSubtaskByID: %w", err)
	}
	return s, nil
}

// CountOrganizationProjectTodoSubtasksByParentID counts subtasks under a parent.
func (r *OrganizationRepo) CountOrganizationProjectTodoSubtasksByParentID(ctx context.Context, projectTodoID uuid.UUID) (int, error) {
	var n int
	if err := r.db.QueryRow(ctx, sqlCountProjectTodoSubtasks, projectTodoID).Scan(&n); err != nil {
		return 0, fmt.Errorf("organizationRepo.CountOrganizationProjectTodoSubtasksByParentID: %w", err)
	}
	return n, nil
}

// NextOrganizationProjectTodoSubtaskSortOrder returns the next sort_order for a new subtask.
func (r *OrganizationRepo) NextOrganizationProjectTodoSubtaskSortOrder(ctx context.Context, projectTodoID uuid.UUID) (int, error) {
	var n int
	if err := r.db.QueryRow(ctx, sqlNextProjectTodoSubtaskSort, projectTodoID).Scan(&n); err != nil {
		return 0, fmt.Errorf("organizationRepo.NextOrganizationProjectTodoSubtaskSortOrder: %w", err)
	}
	return n, nil
}

// CreateOrganizationProjectTodoSubtask inserts a subtask.
func (r *OrganizationRepo) CreateOrganizationProjectTodoSubtask(ctx context.Context, s *model.OrganizationProjectTodoSubtask) error {
	_, err := r.db.Exec(ctx, sqlInsertProjectTodoSubtask,
		s.ID, s.ProjectTodoID, s.Title, s.Completed, s.SortOrder, s.CreatedAt, s.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.CreateOrganizationProjectTodoSubtask: %w", err)
	}
	return nil
}

// UpdateOrganizationProjectTodoSubtask updates a subtask row.
func (r *OrganizationRepo) UpdateOrganizationProjectTodoSubtask(ctx context.Context, s *model.OrganizationProjectTodoSubtask) error {
	res, err := r.db.Exec(ctx, sqlUpdateProjectTodoSubtask, s.ID, s.Title, s.Completed, s.SortOrder, s.UpdatedAt)
	if err != nil {
		return fmt.Errorf("organizationRepo.UpdateOrganizationProjectTodoSubtask: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.UpdateOrganizationProjectTodoSubtask: not found")
	}
	return nil
}

// DeleteOrganizationProjectTodoSubtask deletes by id and parent todo id.
func (r *OrganizationRepo) DeleteOrganizationProjectTodoSubtask(ctx context.Context, id, projectTodoID uuid.UUID) error {
	res, err := r.db.Exec(ctx, sqlDeleteProjectTodoSubtask, id, projectTodoID)
	if err != nil {
		return fmt.Errorf("organizationRepo.DeleteOrganizationProjectTodoSubtask: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.DeleteOrganizationProjectTodoSubtask: not found")
	}
	return nil
}

// ListOrganizationProjectPurchases lists purchase rows for a project (newest first).
func (r *OrganizationRepo) ListOrganizationProjectPurchases(ctx context.Context, projectID uuid.UUID) ([]*model.OrganizationProjectPurchase, error) {
	rows, err := r.db.Query(ctx, sqlListProjectPurchases, projectID)
	if err != nil {
		return nil, fmt.Errorf("organizationRepo.ListOrganizationProjectPurchases: %w", err)
	}
	defer rows.Close()

	var out []*model.OrganizationProjectPurchase
	for rows.Next() {
		p, err := scanOrganizationProjectPurchase(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// GetOrganizationProjectPurchaseByID returns a purchase row or nil.
func (r *OrganizationRepo) GetOrganizationProjectPurchaseByID(ctx context.Context, id uuid.UUID) (*model.OrganizationProjectPurchase, error) {
	row := r.db.QueryRow(ctx, sqlGetProjectPurchaseByID, id)
	p, err := scanOrganizationProjectPurchase(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("organizationRepo.GetOrganizationProjectPurchaseByID: %w", err)
	}
	return p, nil
}

// CreateOrganizationProjectPurchase inserts a purchase line item.
func (r *OrganizationRepo) CreateOrganizationProjectPurchase(ctx context.Context, p *model.OrganizationProjectPurchase) error {
	link := sql.NullString{}
	if p.ProductLink != nil && *p.ProductLink != "" {
		link.String = *p.ProductLink
		link.Valid = true
	}
	_, err := r.db.Exec(ctx, sqlInsertProjectPurchase,
		p.ID, p.ProjectID, p.ProductName, p.TaxRate, p.ProductPurpose, p.Price, p.Quantity, link,
		string(p.Status), p.StatusNote, p.Currency, p.CreatedByUserID, p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.CreateOrganizationProjectPurchase: %w", err)
	}
	return nil
}

// UpdateOrganizationProjectPurchase updates a purchase row.
func (r *OrganizationRepo) UpdateOrganizationProjectPurchase(ctx context.Context, p *model.OrganizationProjectPurchase) error {
	link := sql.NullString{}
	if p.ProductLink != nil && *p.ProductLink != "" {
		link.String = *p.ProductLink
		link.Valid = true
	}
	res, err := r.db.Exec(ctx, sqlUpdateProjectPurchase,
		p.ID, p.ProductName, p.TaxRate, p.ProductPurpose, p.Price, p.Quantity, link,
		string(p.Status), p.StatusNote, p.Currency, p.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("organizationRepo.UpdateOrganizationProjectPurchase: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.UpdateOrganizationProjectPurchase: not found")
	}
	return nil
}

// DeleteOrganizationProjectPurchase deletes a purchase by id.
func (r *OrganizationRepo) DeleteOrganizationProjectPurchase(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.Exec(ctx, sqlDeleteProjectPurchase, id)
	if err != nil {
		return fmt.Errorf("organizationRepo.DeleteOrganizationProjectPurchase: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("organizationRepo.DeleteOrganizationProjectPurchase: not found")
	}
	return nil
}

func scanOrganizationProject(row pgx.Row) (*model.OrganizationProject, error) {
	var p model.OrganizationProject
	err := row.Scan(&p.ID, &p.OrganizationID, &p.Name, &p.Description, &p.CreatedByUserID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func scanOrganizationProjectMember(row pgx.Row) (*model.OrganizationProjectMember, error) {
	var m model.OrganizationProjectMember
	err := row.Scan(&m.ID, &m.ProjectID, &m.UserID, &m.AddedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func uuidPtrFromPgUUID(p pgtype.UUID) *uuid.UUID {
	if !p.Valid {
		return nil
	}
	u := uuid.UUID(p.Bytes)
	return &u
}

func scanOrganizationProjectTodoSubtask(row pgx.Row) (*model.OrganizationProjectTodoSubtask, error) {
	var s model.OrganizationProjectTodoSubtask
	err := row.Scan(&s.ID, &s.ProjectTodoID, &s.Title, &s.Completed, &s.SortOrder, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func scanOrganizationProjectTodo(row pgx.Row) (*model.OrganizationProjectTodo, error) {
	var t model.OrganizationProjectTodo
	var status string
	var assigned pgtype.UUID
	var dueAt sql.NullTime
	err := row.Scan(&t.ID, &t.ProjectID, &t.Title, &status, &t.CreatedByUserID, &assigned, &dueAt, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	t.Status = model.OrganizationProjectTodoStatus(status)
	if t.Status == "" {
		t.Status = model.OrganizationProjectTodoOpen
	}
	t.AssignedToUserID = uuidPtrFromPgUUID(assigned)
	if dueAt.Valid {
		u := dueAt.Time.UTC()
		t.DueAt = &u
	}
	return &t, nil
}

func scanOrganizationProjectPurchase(row pgx.Row) (*model.OrganizationProjectPurchase, error) {
	var p model.OrganizationProjectPurchase
	var status string
	var link sql.NullString
	err := row.Scan(
		&p.ID, &p.ProjectID, &p.ProductName, &p.TaxRate, &p.ProductPurpose, &p.Price, &p.Quantity, &link,
		&status, &p.StatusNote, &p.Currency, &p.CreatedByUserID, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.Status = model.OrganizationProjectPurchaseStatus(status)
	if p.Status == "" {
		p.Status = model.OrganizationProjectPurchaseRequested
	}
	if link.Valid && link.String != "" {
		s := link.String
		p.ProductLink = &s
	}
	return &p, nil
}
