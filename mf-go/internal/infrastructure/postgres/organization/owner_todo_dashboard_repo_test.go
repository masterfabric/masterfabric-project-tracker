package organization

import (
	"strings"
	"testing"
)

func TestProjectVisibleInOrgDashboardScopeSQL_IncludesAcceptedParticipationPath(t *testing.T) {
	sql := projectVisibleInOrgDashboardScopeSQL

	required := []string{
		"p.organization_id = $1",
		"organization_project_org_participations",
		"participant_organization_id = $1",
		"pop.status = 'accepted'",
	}
	for _, token := range required {
		if !strings.Contains(sql, token) {
			t.Fatalf("expected scope SQL to contain %q", token)
		}
	}
}

