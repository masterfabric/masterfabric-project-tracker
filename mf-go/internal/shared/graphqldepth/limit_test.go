package graphqldepth

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func TestSelectionSetDepth_nestedFields(t *testing.T) {
	doc := mustParse(t, `query { a { b { c } } }`)
	op := doc.Operations[0]
	depth := selectionSetDepth(op.SelectionSet, doc, make(map[string]bool))
	require.Equal(t, 3, depth)
}

func TestSelectionSetDepth_siblings(t *testing.T) {
	doc := mustParse(t, `query { a { x } b { y { z } } }`)
	op := doc.Operations[0]
	depth := selectionSetDepth(op.SelectionSet, doc, make(map[string]bool))
	require.Equal(t, 3, depth)
}

func TestSelectionSetDepth_fragment(t *testing.T) {
	doc := mustParse(t, `query Q { u { ...F } } fragment F on X { v { w } }`)
	op := doc.Operations.ForName("Q")
	require.NotNil(t, op)
	depth := selectionSetDepth(op.SelectionSet, doc, make(map[string]bool))
	require.Equal(t, 3, depth)
}

func mustParse(t *testing.T, query string) *ast.QueryDocument {
	t.Helper()
	doc, err := parser.ParseQuery(&ast.Source{Input: query})
	require.NoError(t, err)
	return doc
}
