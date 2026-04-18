package graphqldepth

import (
	"context"
	"fmt"

	"github.com/99designs/gqlgen/graphql"
	"github.com/99designs/gqlgen/graphql/errcode"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
)

const errDepthLimit = "DEPTH_LIMIT_EXCEEDED"

func init() {
	errcode.RegisterErrorType(errDepthLimit, errcode.KindProtocol)
}

// Limit caps maximum field nesting depth per operation (root fields depth = 1).
type Limit struct {
	Max int
}

// FixedLimit returns an extension that rejects queries deeper than max.
func FixedLimit(max int) *Limit {
	return &Limit{Max: max}
}

func (l Limit) ExtensionName() string { return "DepthLimit" }

func (l *Limit) Validate(_ graphql.ExecutableSchema) error {
	if l == nil || l.Max <= 0 {
		return fmt.Errorf("depth limit must be positive")
	}
	return nil
}

func (l *Limit) MutateOperationContext(ctx context.Context, rc *graphql.OperationContext) *gqlerror.Error {
	op := rc.Doc.Operations.ForName(rc.OperationName)
	if op == nil {
		return nil
	}
	seen := make(map[string]bool)
	depth := selectionSetDepth(op.SelectionSet, rc.Doc, seen)
	if depth > l.Max {
		err := gqlerror.Errorf("operation has depth %d, which exceeds the limit of %d", depth, l.Max)
		errcode.Set(err, errDepthLimit)
		return err
	}
	return nil
}

func selectionSetDepth(set ast.SelectionSet, doc *ast.QueryDocument, spreadSeen map[string]bool) int {
	if len(set) == 0 {
		return 0
	}
	maxD := 0
	for _, sel := range set {
		switch s := sel.(type) {
		case *ast.Field:
			sub := 0
			if len(s.SelectionSet) > 0 {
				sub = selectionSetDepth(s.SelectionSet, doc, spreadSeen)
			}
			d := 1 + sub
			if d > maxD {
				maxD = d
			}
		case *ast.InlineFragment:
			d := selectionSetDepth(s.SelectionSet, doc, spreadSeen)
			if d > maxD {
				maxD = d
			}
		case *ast.FragmentSpread:
			frag := doc.Fragments.ForName(s.Name)
			if frag == nil {
				continue
			}
			if spreadSeen[s.Name] {
				continue
			}
			spreadSeen[s.Name] = true
			d := selectionSetDepth(frag.SelectionSet, doc, spreadSeen)
			delete(spreadSeen, s.Name)
			if d > maxD {
				maxD = d
			}
		}
	}
	return maxD
}

var _ graphql.HandlerExtension = (*Limit)(nil)
var _ graphql.OperationContextMutator = (*Limit)(nil)
