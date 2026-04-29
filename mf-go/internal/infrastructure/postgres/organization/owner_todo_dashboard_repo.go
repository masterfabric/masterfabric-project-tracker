package organization

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/masterfabric/masterfabric_go_basic/internal/domain/organization/model"
)

const projectVisibleInOrgDashboardScopeSQL = `
	(
		p.organization_id = $1
		OR EXISTS (
			SELECT 1
			FROM organization_project_org_participations pop
			WHERE pop.project_id = p.id
				AND pop.participant_organization_id = $1
				AND pop.status = 'accepted'
		)
	)
`

// GetOwnerTodoDashboardStats implements GFG-174 aggregate queries.
func (r *OrganizationRepo) GetOwnerTodoDashboardStats(
	ctx context.Context,
	orgID uuid.UUID,
	projectFilter []uuid.UUID,
	includeSubtasks bool,
	periodStart, periodEnd, prevStart, prevEnd time.Time,
) (*model.OwnerTodoDashboardStats, error) {
	filterProjects := len(projectFilter) > 0

	if includeSubtasks {
		return r.ownerDashboardModeB(ctx, r.db, orgID, projectFilter, filterProjects, periodStart, periodEnd, prevStart, prevEnd)
	}
	return r.ownerDashboardModeA(ctx, r.db, orgID, projectFilter, filterProjects, periodStart, periodEnd, prevStart, prevEnd)
}

func (r *OrganizationRepo) ownerDashboardModeA(
	ctx context.Context,
	db *pgxpool.Pool,
	orgID uuid.UUID,
	projectFilter []uuid.UUID,
	filterProjects bool,
	periodStart, periodEnd, prevStart, prevEnd time.Time,
) (*model.OwnerTodoDashboardStats, error) {
	var uo, ud int
	err := db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN NOT completed THEN 1 ELSE 0 END), 0)::int,
			COALESCE(SUM(CASE WHEN completed THEN 1 ELSE 0 END), 0)::int
		FROM user_todos WHERE organization_id = $1
	`, orgID).Scan(&uo, &ud)
	if err != nil {
		return nil, fmt.Errorf("ownerDash user roots: %w", err)
	}

	var po, pd int
	if filterProjects {
		err = db.QueryRow(ctx, `
			SELECT
				COALESCE(SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END), 0)::int,
				COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.project_id = ANY($2::uuid[])
		`, orgID, projectFilter).Scan(&po, &pd)
	} else {
		err = db.QueryRow(ctx, `
			SELECT
				COALESCE(SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END), 0)::int,
				COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+`
		`, orgID).Scan(&po, &pd)
	}
	if err != nil {
		return nil, fmt.Errorf("ownerDash project roots: %w", err)
	}

	compSel, err := countCompletionsUserRootsA(ctx, db, orgID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	c1, err := countCompletionsProjectRootsA(ctx, db, orgID, projectFilter, filterProjects, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	compSel += c1

	compPrev, err := countCompletionsUserRootsA(ctx, db, orgID, prevStart, prevEnd)
	if err != nil {
		return nil, err
	}
	c2, err := countCompletionsProjectRootsA(ctx, db, orgID, projectFilter, filterProjects, prevStart, prevEnd)
	if err != nil {
		return nil, err
	}
	compPrev += c2

	daily, err := buildDailyA(ctx, db, orgID, projectFilter, filterProjects, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}

	donut2, err := doneInPeriodByProjectA(ctx, db, orgID, projectFilter, filterProjects, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}

	assignee, err := openByAssigneeA(ctx, db, orgID, projectFilter, filterProjects)
	if err != nil {
		return nil, err
	}

	return &model.OwnerTodoDashboardStats{
		OpenCount:  uo + po,
		DoneCount:  ud + pd,
		CompSel:    compSel,
		CompPrev:   compPrev,
		Daily:      daily,
		Donut2:     donut2,
		Assignee:   assignee,
	}, nil
}

func countCompletionsUserRootsA(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, s, e time.Time) (int, error) {
	var n int
	err := db.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM user_todos
		WHERE organization_id = $1 AND completed
		  AND updated_at >= $2 AND updated_at < $3
	`, orgID, s, e).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("countCompletionsUserRootsA: %w", err)
	}
	return n, nil
}

func countCompletionsProjectRootsA(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, projectFilter []uuid.UUID, filterProjects bool, s, e time.Time) (int, error) {
	var n int
	var err error
	if filterProjects {
		err = db.QueryRow(ctx, `
			SELECT COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'done' AND t.project_id = ANY($2::uuid[])
			  AND t.updated_at >= $3 AND t.updated_at < $4
		`, orgID, projectFilter, s, e).Scan(&n)
	} else {
		err = db.QueryRow(ctx, `
			SELECT COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'done'
			  AND t.updated_at >= $2 AND t.updated_at < $3
		`, orgID, s, e).Scan(&n)
	}
	if err != nil {
		return 0, fmt.Errorf("countCompletionsProjectRootsA: %w", err)
	}
	return n, nil
}

func buildDailyA(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, projectFilter []uuid.UUID, filterProjects bool, periodStart, periodEnd time.Time) ([]model.OwnerDashboardDayBucket, error) {
	rows, err := db.Query(ctx, `
		WITH days AS (
			SELECT d::date AS d
			FROM generate_series(
				($1::timestamptz AT TIME ZONE 'UTC')::date,
				(($2::timestamptz - interval '1 day') AT TIME ZONE 'UTC')::date,
				interval '1 day'
			) AS s(d)
		)
		SELECT d.d, COALESCE(u.c, 0) + COALESCE(t.c, 0)
		FROM days d
		LEFT JOIN (
			SELECT (u.updated_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS c
			FROM user_todos u
			WHERE u.organization_id = $3 AND u.completed
			  AND u.updated_at >= $1 AND u.updated_at < $2
			GROUP BY 1
		) u ON u.day = d.d
		LEFT JOIN (
			SELECT (t.updated_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS c
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE (
				p.organization_id = $3
				OR EXISTS (
					SELECT 1
					FROM organization_project_org_participations pop
					WHERE pop.project_id = p.id
						AND pop.participant_organization_id = $3
						AND pop.status = 'accepted'
				)
			) AND t.status = 'done'
			  AND t.updated_at >= $1 AND t.updated_at < $2
			  AND (NOT $4::bool OR t.project_id = ANY($5::uuid[]))
			GROUP BY 1
		) t ON t.day = d.d
		ORDER BY d.d
	`, periodStart, periodEnd, orgID, filterProjects, projectFilter)
	if err != nil {
		return nil, fmt.Errorf("buildDailyA: %w", err)
	}
	defer rows.Close()

	var out []model.OwnerDashboardDayBucket
	for rows.Next() {
		var d time.Time
		var c int
		if err := rows.Scan(&d, &c); err != nil {
			return nil, err
		}
		day := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
		out = append(out, model.OwnerDashboardDayBucket{Day: day, CompletedCount: c})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if out == nil {
		out = []model.OwnerDashboardDayBucket{}
	}
	return out, nil
}

func doneInPeriodByProjectA(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, projectFilter []uuid.UUID, filterProjects bool, s, e time.Time) ([]model.OwnerProjectDoneInPeriod, error) {
	// General (org user todo roots) completions in window
	var gen int
	err := db.QueryRow(ctx, `
		SELECT COUNT(*)::int FROM user_todos
		WHERE organization_id = $1 AND completed
		  AND updated_at >= $2 AND updated_at < $3
	`, orgID, s, e).Scan(&gen)
	if err != nil {
		return nil, fmt.Errorf("doneInPeriodByProjectA general: %w", err)
	}

	var rows pgx.Rows
	if filterProjects {
		rows, err = db.Query(ctx, `
			SELECT t.project_id, p.name, COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'done' AND t.project_id = ANY($2::uuid[])
			  AND t.updated_at >= $3 AND t.updated_at < $4
			GROUP BY t.project_id, p.name
			ORDER BY p.name
		`, orgID, projectFilter, s, e)
	} else {
		rows, err = db.Query(ctx, `
			SELECT t.project_id, p.name, COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'done'
			  AND t.updated_at >= $2 AND t.updated_at < $3
			GROUP BY t.project_id, p.name
			ORDER BY p.name
		`, orgID, s, e)
	}
	if err != nil {
		return nil, fmt.Errorf("doneInPeriodByProjectA projects: %w", err)
	}
	defer rows.Close()

	out := []model.OwnerProjectDoneInPeriod{
		{IsGeneral: true, Count: gen, ProjectName: nil, ProjectID: nil},
	}
	for rows.Next() {
		var pid uuid.UUID
		var name string
		var n int
		if err := rows.Scan(&pid, &name, &n); err != nil {
			return nil, err
		}
		pn := name
		pidCopy := pid
		out = append(out, model.OwnerProjectDoneInPeriod{ProjectID: &pidCopy, ProjectName: &pn, IsGeneral: false, Count: n})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func openByAssigneeA(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, projectFilter []uuid.UUID, filterProjects bool) ([]model.OwnerAssigneeOpenSlice, error) {
	agg := map[uuid.UUID]int{}
	unassigned := 0

	rows, err := db.Query(ctx, `
		SELECT assigned_to_user_id, COUNT(*)::int
		FROM user_todos
		WHERE organization_id = $1 AND NOT completed
		GROUP BY assigned_to_user_id
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("openByAssigneeA user: %w", err)
	}
	for rows.Next() {
		var raw pgtype.UUID
		var c int
		if err := rows.Scan(&raw, &c); err != nil {
			rows.Close()
			return nil, err
		}
		if !raw.Valid {
			unassigned += c
			continue
		}
		uid, err := uuid.FromBytes(raw.Bytes[:])
		if err != nil {
			rows.Close()
			return nil, err
		}
		agg[uid] += c
	}
	rows.Close()

	// Project open roots
	var pq pgx.Rows
	if filterProjects {
		pq, err = db.Query(ctx, `
			SELECT t.assigned_to_user_id, COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'open' AND t.project_id = ANY($2::uuid[])
			GROUP BY t.assigned_to_user_id
		`, orgID, projectFilter)
	} else {
		pq, err = db.Query(ctx, `
			SELECT t.assigned_to_user_id, COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'open'
			GROUP BY t.assigned_to_user_id
		`, orgID)
	}
	if err != nil {
		return nil, fmt.Errorf("openByAssigneeA project: %w", err)
	}
	defer pq.Close()
	for pq.Next() {
		var raw pgtype.UUID
		var c int
		if err := pq.Scan(&raw, &c); err != nil {
			return nil, err
		}
		if !raw.Valid {
			unassigned += c
			continue
		}
		uid, err := uuid.FromBytes(raw.Bytes[:])
		if err != nil {
			return nil, err
		}
		agg[uid] += c
	}
	if err := pq.Err(); err != nil {
		return nil, err
	}

	var uids []uuid.UUID
	for id := range agg {
		uids = append(uids, id)
	}
	nick := map[uuid.UUID]string{}
	if len(uids) > 0 {
		nq, err := db.Query(ctx, `
			SELECT id, COALESCE(NULLIF(TRIM(nickname), ''), NULLIF(TRIM(display_name), ''), '')::text
			FROM users WHERE id = ANY($1::uuid[])
		`, uids)
		if err != nil {
			return nil, err
		}
		for nq.Next() {
			var id uuid.UUID
			var nk string
			if err := nq.Scan(&id, &nk); err != nil {
				nq.Close()
				return nil, err
			}
			nick[id] = nk
		}
		nq.Close()
	}

	var out []model.OwnerAssigneeOpenSlice
	if unassigned > 0 {
		out = append(out, model.OwnerAssigneeOpenSlice{UserID: nil, Nickname: "", OpenCount: unassigned})
	}
	for id, c := range agg {
		uid := id
		nk := nick[id]
		out = append(out, model.OwnerAssigneeOpenSlice{UserID: &uid, Nickname: nk, OpenCount: c})
	}
	// stable sort: nicknames
	if out == nil {
		out = []model.OwnerAssigneeOpenSlice{}
	}
	return out, nil
}

// ── Mode B: roots + subtasks as separate units ───────────────────────────────

func (r *OrganizationRepo) ownerDashboardModeB(
	ctx context.Context,
	db *pgxpool.Pool,
	orgID uuid.UUID,
	projectFilter []uuid.UUID,
	filterProjects bool,
	periodStart, periodEnd, prevStart, prevEnd time.Time,
) (*model.OwnerTodoDashboardStats, error) {
	// User roots
	var uo, ud int
	err := db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN NOT completed THEN 1 ELSE 0 END), 0)::int,
			COALESCE(SUM(CASE WHEN completed THEN 1 ELSE 0 END), 0)::int
		FROM user_todos WHERE organization_id = $1
	`, orgID).Scan(&uo, &ud)
	if err != nil {
		return nil, fmt.Errorf("ownerDashB user roots: %w", err)
	}
	// User subtasks
	var so, sd int
	err = db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN NOT s.completed THEN 1 ELSE 0 END), 0)::int,
			COALESCE(SUM(CASE WHEN s.completed THEN 1 ELSE 0 END), 0)::int
		FROM user_todo_subtasks s
		INNER JOIN user_todos u ON u.id = s.user_todo_id
		WHERE u.organization_id = $1
	`, orgID).Scan(&so, &sd)
	if err != nil {
		return nil, fmt.Errorf("ownerDashB user subs: %w", err)
	}

	// Project roots
	var po, pd int
	if filterProjects {
		err = db.QueryRow(ctx, `
			SELECT
				COALESCE(SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END), 0)::int,
				COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.project_id = ANY($2::uuid[])
		`, orgID, projectFilter).Scan(&po, &pd)
	} else {
		err = db.QueryRow(ctx, `
			SELECT
				COALESCE(SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END), 0)::int,
				COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+`
		`, orgID).Scan(&po, &pd)
	}
	if err != nil {
		return nil, fmt.Errorf("ownerDashB project roots: %w", err)
	}

	// Project subtasks
	var pso, psd int
	if filterProjects {
		err = db.QueryRow(ctx, `
			SELECT
				COALESCE(SUM(CASE WHEN NOT s.completed THEN 1 ELSE 0 END), 0)::int,
				COALESCE(SUM(CASE WHEN s.completed THEN 1 ELSE 0 END), 0)::int
			FROM organization_project_todo_subtasks s
			INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.project_id = ANY($2::uuid[])
		`, orgID, projectFilter).Scan(&pso, &psd)
	} else {
		err = db.QueryRow(ctx, `
			SELECT
				COALESCE(SUM(CASE WHEN NOT s.completed THEN 1 ELSE 0 END), 0)::int,
				COALESCE(SUM(CASE WHEN s.completed THEN 1 ELSE 0 END), 0)::int
			FROM organization_project_todo_subtasks s
			INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+`
		`, orgID).Scan(&pso, &psd)
	}
	if err != nil {
		return nil, fmt.Errorf("ownerDashB project subs: %w", err)
	}

	compSel := 0
	cu, err := countCompUserB(ctx, db, orgID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	compSel += cu
	cp, err := countCompProjectB(ctx, db, orgID, projectFilter, filterProjects, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	compSel += cp

	compPrev := 0
	cu, err = countCompUserB(ctx, db, orgID, prevStart, prevEnd)
	if err != nil {
		return nil, err
	}
	compPrev += cu
	cp, err = countCompProjectB(ctx, db, orgID, projectFilter, filterProjects, prevStart, prevEnd)
	if err != nil {
		return nil, err
	}
	compPrev += cp

	daily, err := buildDailyB(ctx, db, orgID, projectFilter, filterProjects, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}

	donut2, err := doneInPeriodByProjectB(ctx, db, orgID, projectFilter, filterProjects, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}

	assignee, err := openByAssigneeB(ctx, db, orgID, projectFilter, filterProjects)
	if err != nil {
		return nil, err
	}

	return &model.OwnerTodoDashboardStats{
		OpenCount:  uo + so + po + pso,
		DoneCount:  ud + sd + pd + psd,
		CompSel:    compSel,
		CompPrev:   compPrev,
		Daily:      daily,
		Donut2:     donut2,
		Assignee:   assignee,
	}, nil
}

func countCompUserB(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, s, e time.Time) (int, error) {
	var n int
	err := db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM user_todos
			 WHERE organization_id = $1 AND completed AND updated_at >= $2 AND updated_at < $3)
			+ (SELECT COUNT(*)::int
			   FROM user_todo_subtasks s
			   INNER JOIN user_todos u ON u.id = s.user_todo_id
			   WHERE u.organization_id = $1 AND s.completed AND s.updated_at >= $2 AND s.updated_at < $3)
	`, orgID, s, e).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("countCompUserB: %w", err)
	}
	return n, nil
}

func countCompProjectB(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, projectFilter []uuid.UUID, filterProjects bool, s, e time.Time) (int, error) {
	var n int
	var err error
	if filterProjects {
		err = db.QueryRow(ctx, `
			SELECT
				(SELECT COUNT(*)::int
				 FROM organization_project_todos t
				 INNER JOIN organization_projects p ON p.id = t.project_id
				 WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'done' AND t.project_id = ANY($2::uuid[])
				   AND t.updated_at >= $3 AND t.updated_at < $4)
				+ (SELECT COUNT(*)::int
				   FROM organization_project_todo_subtasks s
				   INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
				   INNER JOIN organization_projects p ON p.id = t.project_id
				   WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.project_id = ANY($2::uuid[]) AND s.completed
				     AND s.updated_at >= $3 AND s.updated_at < $4)
		`, orgID, projectFilter, s, e).Scan(&n)
	} else {
		err = db.QueryRow(ctx, `
			SELECT
				(SELECT COUNT(*)::int
				 FROM organization_project_todos t
				 INNER JOIN organization_projects p ON p.id = t.project_id
				 WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'done'
				   AND t.updated_at >= $2 AND t.updated_at < $3)
				+ (SELECT COUNT(*)::int
				   FROM organization_project_todo_subtasks s
				   INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
				   INNER JOIN organization_projects p ON p.id = t.project_id
				   WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND s.completed
				     AND s.updated_at >= $2 AND s.updated_at < $3)
		`, orgID, s, e).Scan(&n)
	}
	if err != nil {
		return 0, fmt.Errorf("countCompProjectB: %w", err)
	}
	return n, nil
}

func buildDailyB(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, projectFilter []uuid.UUID, filterProjects bool, periodStart, periodEnd time.Time) ([]model.OwnerDashboardDayBucket, error) {
	rows, err := db.Query(ctx, `
		WITH days AS (
			SELECT d::date AS d
			FROM generate_series(
				($1::timestamptz AT TIME ZONE 'UTC')::date,
				((($2::timestamptz - interval '1 day') AT TIME ZONE 'UTC'))::date,
				interval '1 day'
			) AS s(d)
		)
		SELECT d.d,
			COALESCE(u.c, 0) + COALESCE(ut.c, 0) + COALESCE(t.c, 0) + COALESCE(st.c, 0)
		FROM days d
		LEFT JOIN (
			SELECT (u.updated_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS c
			FROM user_todos u
			WHERE u.organization_id = $3 AND u.completed
			  AND u.updated_at >= $1 AND u.updated_at < $2
			GROUP BY 1
		) u ON u.day = d.d
		LEFT JOIN (
			SELECT (s.updated_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS c
			FROM user_todo_subtasks s
			INNER JOIN user_todos u ON u.id = s.user_todo_id
			WHERE u.organization_id = $3 AND s.completed
			  AND s.updated_at >= $1 AND s.updated_at < $2
			GROUP BY 1
		) ut ON ut.day = d.d
		LEFT JOIN (
			SELECT (t.updated_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS c
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE (
				p.organization_id = $3
				OR EXISTS (
					SELECT 1
					FROM organization_project_org_participations pop
					WHERE pop.project_id = p.id
						AND pop.participant_organization_id = $3
						AND pop.status = 'accepted'
				)
			) AND t.status = 'done'
			  AND t.updated_at >= $1 AND t.updated_at < $2
			  AND (NOT $4::bool OR t.project_id = ANY($5::uuid[]))
			GROUP BY 1
		) t ON t.day = d.d
		LEFT JOIN (
			SELECT (s.updated_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS c
			FROM organization_project_todo_subtasks s
			INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE (
				p.organization_id = $3
				OR EXISTS (
					SELECT 1
					FROM organization_project_org_participations pop
					WHERE pop.project_id = p.id
						AND pop.participant_organization_id = $3
						AND pop.status = 'accepted'
				)
			) AND s.completed
			  AND s.updated_at >= $1 AND s.updated_at < $2
			  AND (NOT $4::bool OR t.project_id = ANY($5::uuid[]))
			GROUP BY 1
		) st ON st.day = d.d
		ORDER BY d.d
	`, periodStart, periodEnd, orgID, filterProjects, projectFilter)
	if err != nil {
		return nil, fmt.Errorf("buildDailyB: %w", err)
	}
	defer rows.Close()
	var out []model.OwnerDashboardDayBucket
	for rows.Next() {
		var d time.Time
		var c int
		if err := rows.Scan(&d, &c); err != nil {
			return nil, err
		}
		day := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
		out = append(out, model.OwnerDashboardDayBucket{Day: day, CompletedCount: c})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if out == nil {
		out = []model.OwnerDashboardDayBucket{}
	}
	return out, nil
}

func doneInPeriodByProjectB(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, projectFilter []uuid.UUID, filterProjects bool, s, e time.Time) ([]model.OwnerProjectDoneInPeriod, error) {
	var gen int
	err := db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM user_todos
			 WHERE organization_id = $1 AND completed AND updated_at >= $2 AND updated_at < $3)
			+ (SELECT COUNT(*)::int
			   FROM user_todo_subtasks s
			   INNER JOIN user_todos u ON u.id = s.user_todo_id
			   WHERE u.organization_id = $1 AND s.completed AND s.updated_at >= $2 AND s.updated_at < $3)
	`, orgID, s, e).Scan(&gen)
	if err != nil {
		return nil, fmt.Errorf("doneInPeriodByProjectB general: %w", err)
	}
	out := []model.OwnerProjectDoneInPeriod{
		{IsGeneral: true, Count: gen, ProjectName: nil, ProjectID: nil},
	}

	counts := map[uuid.UUID]int{}
	names := map[uuid.UUID]string{}

	add := func(id uuid.UUID, name string, n int) {
		counts[id] += n
		if name != "" {
			names[id] = name
		}
	}

	var r1 pgx.Rows
	if filterProjects {
		r1, err = db.Query(ctx, `
			SELECT t.project_id, p.name, COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'done' AND t.project_id = ANY($2::uuid[])
			  AND t.updated_at >= $3 AND t.updated_at < $4
			GROUP BY t.project_id, p.name
		`, orgID, projectFilter, s, e)
	} else {
		r1, err = db.Query(ctx, `
			SELECT t.project_id, p.name, COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'done'
			  AND t.updated_at >= $2 AND t.updated_at < $3
			GROUP BY t.project_id, p.name
		`, orgID, s, e)
	}
	if err != nil {
		return nil, fmt.Errorf("doneInPeriodByProjectB roots: %w", err)
	}
	for r1.Next() {
		var pid uuid.UUID
		var name string
		var n int
		if err := r1.Scan(&pid, &name, &n); err != nil {
			r1.Close()
			return nil, err
		}
		add(pid, name, n)
	}
	r1.Close()

	var r2 pgx.Rows
	if filterProjects {
		r2, err = db.Query(ctx, `
			SELECT t.project_id, p.name, COUNT(*)::int
			FROM organization_project_todo_subtasks s
			INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND s.completed AND t.project_id = ANY($2::uuid[])
			  AND s.updated_at >= $3 AND s.updated_at < $4
			GROUP BY t.project_id, p.name
		`, orgID, projectFilter, s, e)
	} else {
		r2, err = db.Query(ctx, `
			SELECT t.project_id, p.name, COUNT(*)::int
			FROM organization_project_todo_subtasks s
			INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND s.completed
			  AND s.updated_at >= $2 AND s.updated_at < $3
			GROUP BY t.project_id, p.name
		`, orgID, s, e)
	}
	if err != nil {
		return nil, fmt.Errorf("doneInPeriodByProjectB subs: %w", err)
	}
	for r2.Next() {
		var pid uuid.UUID
		var name string
		var n int
		if err := r2.Scan(&pid, &name, &n); err != nil {
			r2.Close()
			return nil, err
		}
		add(pid, name, n)
	}
	r2.Close()

	for pid, n := range counts {
		if n == 0 {
			continue
		}
		nm := names[pid]
		pc := pid
		nn := nm
		out = append(out, model.OwnerProjectDoneInPeriod{ProjectID: &pc, ProjectName: &nn, IsGeneral: false, Count: n})
	}
	return out, nil
}

func openByAssigneeB(ctx context.Context, db *pgxpool.Pool, orgID uuid.UUID, projectFilter []uuid.UUID, filterProjects bool) ([]model.OwnerAssigneeOpenSlice, error) {
	agg := map[uuid.UUID]int{}
	unassigned := 0

	merge := func(userID *uuid.UUID, c int) {
		if userID == nil {
			unassigned += c
			return
		}
		agg[*userID] += c
	}

	ur, err := db.Query(ctx, `
		SELECT assigned_to_user_id, COUNT(*)::int
		FROM user_todos
		WHERE organization_id = $1 AND NOT completed
		GROUP BY assigned_to_user_id
	`, orgID)
	if err != nil {
		return nil, err
	}
	for ur.Next() {
		var raw pgtype.UUID
		var c int
		if err := ur.Scan(&raw, &c); err != nil {
			ur.Close()
			return nil, err
		}
		if !raw.Valid {
			merge(nil, c)
			continue
		}
		uid, err := uuid.FromBytes(raw.Bytes[:])
		if err != nil {
			ur.Close()
			return nil, err
		}
		merge(&uid, c)
	}
	ur.Close()

	usr, err := db.Query(ctx, `
		SELECT u.assigned_to_user_id, COUNT(*)::int
		FROM user_todo_subtasks s
		INNER JOIN user_todos u ON u.id = s.user_todo_id
		WHERE u.organization_id = $1 AND NOT s.completed
		GROUP BY u.assigned_to_user_id
	`, orgID)
	if err != nil {
		return nil, err
	}
	for usr.Next() {
		var raw pgtype.UUID
		var c int
		if err := usr.Scan(&raw, &c); err != nil {
			usr.Close()
			return nil, err
		}
		if !raw.Valid {
			merge(nil, c)
			continue
		}
		uid, err := uuid.FromBytes(raw.Bytes[:])
		if err != nil {
			usr.Close()
			return nil, err
		}
		merge(&uid, c)
	}
	usr.Close()

	var pr pgx.Rows
	if filterProjects {
		pr, err = db.Query(ctx, `
			SELECT t.assigned_to_user_id, COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'open' AND t.project_id = ANY($2::uuid[])
			GROUP BY t.assigned_to_user_id
		`, orgID, projectFilter)
	} else {
		pr, err = db.Query(ctx, `
			SELECT t.assigned_to_user_id, COUNT(*)::int
			FROM organization_project_todos t
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND t.status = 'open'
			GROUP BY t.assigned_to_user_id
		`, orgID)
	}
	if err != nil {
		return nil, err
	}
	for pr.Next() {
		var raw pgtype.UUID
		var c int
		if err := pr.Scan(&raw, &c); err != nil {
			pr.Close()
			return nil, err
		}
		if !raw.Valid {
			merge(nil, c)
			continue
		}
		uid, err := uuid.FromBytes(raw.Bytes[:])
		if err != nil {
			pr.Close()
			return nil, err
		}
		merge(&uid, c)
	}
	pr.Close()

	if filterProjects {
		pr, err = db.Query(ctx, `
			SELECT t.assigned_to_user_id, COUNT(*)::int
			FROM organization_project_todo_subtasks s
			INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND NOT s.completed AND t.project_id = ANY($2::uuid[])
			GROUP BY t.assigned_to_user_id
		`, orgID, projectFilter)
	} else {
		pr, err = db.Query(ctx, `
			SELECT t.assigned_to_user_id, COUNT(*)::int
			FROM organization_project_todo_subtasks s
			INNER JOIN organization_project_todos t ON t.id = s.project_todo_id
			INNER JOIN organization_projects p ON p.id = t.project_id
			WHERE `+projectVisibleInOrgDashboardScopeSQL+` AND NOT s.completed
			GROUP BY t.assigned_to_user_id
		`, orgID)
	}
	if err != nil {
		return nil, err
	}
	for pr.Next() {
		var raw pgtype.UUID
		var c int
		if err := pr.Scan(&raw, &c); err != nil {
			pr.Close()
			return nil, err
		}
		if !raw.Valid {
			merge(nil, c)
			continue
		}
		uid, err := uuid.FromBytes(raw.Bytes[:])
		if err != nil {
			pr.Close()
			return nil, err
		}
		merge(&uid, c)
	}
	pr.Close()

	var uids []uuid.UUID
	for id := range agg {
		uids = append(uids, id)
	}
	nick := map[uuid.UUID]string{}
	if len(uids) > 0 {
		nq, err := db.Query(ctx, `
			SELECT id, COALESCE(NULLIF(TRIM(nickname), ''), NULLIF(TRIM(display_name), ''), '')::text
			FROM users WHERE id = ANY($1::uuid[])
		`, uids)
		if err != nil {
			return nil, err
		}
		for nq.Next() {
			var id uuid.UUID
			var nk string
			if err := nq.Scan(&id, &nk); err != nil {
				nq.Close()
				return nil, err
			}
			nick[id] = nk
		}
		nq.Close()
	}

	var out []model.OwnerAssigneeOpenSlice
	if unassigned > 0 {
		out = append(out, model.OwnerAssigneeOpenSlice{UserID: nil, Nickname: "", OpenCount: unassigned})
	}
	for id, c := range agg {
		uid := id
		nk := nick[id]
		out = append(out, model.OwnerAssigneeOpenSlice{UserID: &uid, Nickname: nk, OpenCount: c})
	}
	if out == nil {
		out = []model.OwnerAssigneeOpenSlice{}
	}
	return out, nil
}
