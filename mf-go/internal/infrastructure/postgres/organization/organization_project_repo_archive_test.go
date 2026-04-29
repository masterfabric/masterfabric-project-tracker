package organization

import (
	"strings"
	"testing"
)

func TestOrganizationProjectQueries_ExcludeArchivedRows(t *testing.T) {
	cases := map[string]string{
		"project get":         sqlGetOrgProjectByID,
		"project list":        sqlListOrgProjectsByOrg,
		"project member list": sqlListOrgProjectsForMember,
		"todo list":           sqlListProjectTodos,
		"todo get":            sqlGetProjectTodoByID,
	}
	for name, q := range cases {
		if !strings.Contains(q, "archived_at IS NULL") {
			t.Fatalf("%s query must filter archived rows", name)
		}
	}
}

func TestOrganizationProjectTodoSubtaskQueries_RespectParentArchiveVisibility(t *testing.T) {
	cases := map[string]string{
		"list":  sqlListProjectTodoSubtasks,
		"get":   sqlGetProjectTodoSubtaskByID,
		"count": sqlCountProjectTodoSubtasks,
		"next":  sqlNextProjectTodoSubtaskSort,
	}
	for name, q := range cases {
		if !strings.Contains(q, "opt.archived_at IS NULL") {
			t.Fatalf("%s subtask query must require active parent todo", name)
		}
	}
}

func TestOrganizationProjectArchiveQueriesAndMutationsUseArchiveState(t *testing.T) {
	cases := map[string]string{
		"archived projects list by org":      sqlListArchivedOrgProjectsByOrg,
		"archived projects list by member":   sqlListArchivedOrgProjectsForMember,
		"archived project todos list":        sqlListArchivedProjectTodos,
	}
	for name, q := range cases {
		if !strings.Contains(q, "archived_at IS NOT NULL") {
			t.Fatalf("%s must filter archived rows", name)
		}
	}
	if !strings.Contains(sqlArchiveOrgProject, "archived_at IS NULL") {
		t.Fatalf("project archive query must only archive active rows")
	}
	if !strings.Contains(sqlUnarchiveOrgProject, "archived_at IS NOT NULL") {
		t.Fatalf("project unarchive query must only unarchive archived rows")
	}
	if !strings.Contains(sqlArchiveProjectTodo, "archived_at IS NULL") {
		t.Fatalf("project todo archive query must only archive active rows")
	}
	if !strings.Contains(sqlUnarchiveProjectTodo, "archived_at IS NOT NULL") {
		t.Fatalf("project todo unarchive query must only unarchive archived rows")
	}
}
