package todos

import (
	"strings"
	"testing"
)

func TestUserTodoQueries_ExcludeArchivedRows(t *testing.T) {
	cases := map[string]string{
		"list":  sqlListTodosByUserID,
		"owned": sqlListOwnedTodosByUserID,
		"get":   sqlGetTodoByID,
	}
	for name, q := range cases {
		if !strings.Contains(q, "archived_at IS NULL") {
			t.Fatalf("%s query must filter archived rows", name)
		}
	}
}

func TestUserTodoSubtaskQueries_RespectParentArchiveVisibility(t *testing.T) {
	cases := map[string]string{
		"list":  sqlListUserTodoSubtasks,
		"get":   sqlGetUserTodoSubtaskByID,
		"count": sqlCountUserTodoSubtasks,
		"next":  sqlNextUserTodoSubtaskSort,
	}
	for name, q := range cases {
		if !strings.Contains(q, "ut.archived_at IS NULL") {
			t.Fatalf("%s subtask query must require active parent todo", name)
		}
	}
}
