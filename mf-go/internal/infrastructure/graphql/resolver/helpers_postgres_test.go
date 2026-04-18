package resolver

import (
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

// Simulates drivers where SQLSTATE appears only in Error() text, not as *pgconn.PgError for errors.As.
type opaqueStringErr struct{ s string }

func (e opaqueStringErr) Error() string { return e.s }

func TestMapPostgresToDomain_42703StringInChain(t *testing.T) {
	err := fmt.Errorf("todoRepo.Create: %w", opaqueStringErr{s: `ERROR: column "due_at" of relation "user_todos" does not exist (SQLSTATE 42703)`})
	de := mapPostgresToDomain(err)
	if de == nil {
		t.Fatal("expected SCHEMA_OUT_OF_DATE")
	}
	if de.Code != "SCHEMA_OUT_OF_DATE" {
		t.Fatalf("code=%q want SCHEMA_OUT_OF_DATE", de.Code)
	}
}

func TestMapPostgresToDomain_PgError42703Wrapped(t *testing.T) {
	inner := &pgconn.PgError{Code: "42703", Message: `column "due_at" of relation "user_todos" does not exist`}
	err := fmt.Errorf("todoRepo.Create: %w", inner)
	de := mapPostgresToDomain(err)
	if de == nil {
		t.Fatal("expected domain error")
	}
	if de.Code != "SCHEMA_OUT_OF_DATE" {
		t.Fatalf("code=%q want SCHEMA_OUT_OF_DATE", de.Code)
	}
}
