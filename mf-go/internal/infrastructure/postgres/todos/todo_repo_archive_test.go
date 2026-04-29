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

func TestUserTodoArchivedQueriesAndMutationsUseArchiveState(t *testing.T) {
	if !strings.Contains(sqlListArchivedTodosByUserID, "archived_at IS NOT NULL") {
		t.Fatalf("archived list query must filter archived rows")
	}
	if !strings.Contains(sqlArchiveTodo, "archived_at IS NULL") {
		t.Fatalf("archive query must only archive active rows")
	}
	if !strings.Contains(sqlUnarchiveTodo, "archived_at IS NOT NULL") {
		t.Fatalf("unarchive query must only unarchive archived rows")
	}
}
