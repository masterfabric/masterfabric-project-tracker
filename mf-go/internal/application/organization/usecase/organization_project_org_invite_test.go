package usecase

import (
	"bytes"
	"testing"
)

func TestParseOrgProjectInviteCapabilitiesJSON(t *testing.T) {
	t.Parallel()
	empty := ""
	space := "   "
	valid := `{"todos":true,"purchases":false}`
	array := `[1,2]`
	invalid := `{`

	t.Run("nil yields empty object", func(t *testing.T) {
		t.Parallel()
		b, err := parseOrgProjectInviteCapabilitiesJSON(nil)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(b, []byte("{}")) {
			t.Fatalf("got %q want {}", string(b))
		}
	})
	t.Run("empty string yields empty object", func(t *testing.T) {
		t.Parallel()
		b, err := parseOrgProjectInviteCapabilitiesJSON(&empty)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(b, []byte("{}")) {
			t.Fatalf("got %q want {}", string(b))
		}
	})
	t.Run("whitespace only yields empty object", func(t *testing.T) {
		t.Parallel()
		b, err := parseOrgProjectInviteCapabilitiesJSON(&space)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(b, []byte("{}")) {
			t.Fatalf("got %q want {}", string(b))
		}
	})
	t.Run("valid object preserved", func(t *testing.T) {
		t.Parallel()
		b, err := parseOrgProjectInviteCapabilitiesJSON(&valid)
		if err != nil {
			t.Fatal(err)
		}
		if string(b) != valid {
			t.Fatalf("got %q want %q", string(b), valid)
		}
	})
	t.Run("array rejected", func(t *testing.T) {
		t.Parallel()
		_, err := parseOrgProjectInviteCapabilitiesJSON(&array)
		if err == nil {
			t.Fatal("expected error for JSON array")
		}
	})
	t.Run("invalid JSON rejected", func(t *testing.T) {
		t.Parallel()
		_, err := parseOrgProjectInviteCapabilitiesJSON(&invalid)
		if err == nil {
			t.Fatal("expected error for invalid JSON")
		}
	})
}
