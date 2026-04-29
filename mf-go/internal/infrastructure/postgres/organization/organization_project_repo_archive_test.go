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
