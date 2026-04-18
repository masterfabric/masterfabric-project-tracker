// Package parser reads *.graphqls files and builds a normalised Schema
// representation that code generators consume.
//
// It intentionally uses the same gqlparser/v2 library that gqlgen already
// pulls in, so no extra dependency is needed.
package parser

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

// ── Public schema model ──────────────────────────────────────────────────────

// Schema is the normalised, generator-friendly representation of the parsed
// GraphQL schema.
type Schema struct {
	// Objects holds every named object type (excluding Query/Mutation roots).
	Objects []*ObjectType
	// Inputs holds every input type.
	Inputs []*InputType
	// Enums holds every enum type.
	Enums []*EnumType
	// Queries holds every query field from the Query root type.
	Queries []*Operation
	// Mutations holds every mutation field from the Mutation root type.
	Mutations []*Operation

	// raw is kept for advanced use.
	raw *ast.Schema
}

// ObjectType represents a named output type (e.g. AuthPayload).
type ObjectType struct {
	Name   string
	Fields []*Field
}

// InputType represents an input type (e.g. RegisterInput).
type InputType struct {
	Name   string
	Fields []*Field
}

// EnumType represents a GraphQL enum (e.g. UserStatus).
type EnumType struct {
	Name   string
	Values []string
}

// Field represents a single field in an object or input type.
type Field struct {
	Name     string
	TypeName string // scalar or named type, without wrapping
	NonNull  bool
	IsList   bool
}

// Operation represents a single Query or Mutation field.
type Operation struct {
	Name       string
	Args       []*Argument
	ReturnType string
	ReturnList bool
	ReturnNull bool // true when the return type is nullable
	IsMutation bool
}

// Argument represents one argument of a query/mutation.
type Argument struct {
	Name     string
	TypeName string
	NonNull  bool
}

// ── Parser ───────────────────────────────────────────────────────────────────

// LoadSchema reads every *.graphqls file from dir, parses them with gqlparser
// and returns a Schema ready for code generation.
func LoadSchema(dir string) (*Schema, error) {
	entries, err := filepath.Glob(filepath.Join(dir, "*.graphqls"))
	if err != nil {
		return nil, fmt.Errorf("glob schema files: %w", err)
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("no *.graphqls files found in %s", dir)
	}

	// gqlparser expects []*ast.Source
	var sources []*ast.Source
	for _, path := range entries {
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", path, err)
		}
		sources = append(sources, &ast.Source{
			Name:  filepath.Base(path),
			Input: string(data),
		})
	}

	raw, gqlErr := gqlparser.LoadSchema(sources...)
	if gqlErr != nil {
		return nil, fmt.Errorf("parse schema: %w", gqlErr)
	}

	return build(raw), nil
}

// ── Internal builder ─────────────────────────────────────────────────────────

// builtins are types we skip when generating Dart models.
var builtins = map[string]bool{
	"String": true, "Int": true, "Float": true, "Boolean": true, "ID": true,
	"Time": true, "UUID": true,
	"Query": true, "Mutation": true, "Subscription": true,
	"__Schema": true, "__Type": true, "__TypeKind": true,
	"__Field": true, "__InputValue": true, "__EnumValue": true,
	"__Directive": true, "__DirectiveLocation": true,
}

func build(raw *ast.Schema) *Schema {
	s := &Schema{raw: raw}

	for name, def := range raw.Types {
		if builtins[name] || strings.HasPrefix(name, "__") {
			continue
		}
		switch def.Kind {
		case ast.Object:
			s.Objects = append(s.Objects, buildObject(def))
		case ast.InputObject:
			s.Inputs = append(s.Inputs, buildInput(def))
		case ast.Enum:
			s.Enums = append(s.Enums, buildEnum(def))
		}
	}

	// Query root
	if qt, ok := raw.Types["Query"]; ok {
		for _, f := range qt.Fields {
			s.Queries = append(s.Queries, buildOperation(f, false))
		}
	}
	// Mutation root
	if mt, ok := raw.Types["Mutation"]; ok {
		for _, f := range mt.Fields {
			s.Mutations = append(s.Mutations, buildOperation(f, true))
		}
	}

	return s
}

func buildObject(def *ast.Definition) *ObjectType {
	o := &ObjectType{Name: def.Name}
	for _, f := range def.Fields {
		o.Fields = append(o.Fields, buildField(f.Name, f.Type))
	}
	return o
}

func buildInput(def *ast.Definition) *InputType {
	i := &InputType{Name: def.Name}
	for _, f := range def.Fields {
		i.Fields = append(i.Fields, buildField(f.Name, f.Type))
	}
	return i
}

func buildEnum(def *ast.Definition) *EnumType {
	e := &EnumType{Name: def.Name}
	for _, v := range def.EnumValues {
		e.Values = append(e.Values, v.Name)
	}
	return e
}

// resolveTypeName unwraps a possibly NonNull or List ast.Type and returns
// (typeName, isList, nonNull).
func resolveTypeName(t *ast.Type) (name string, isList bool, nonNull bool) {
	if t == nil {
		return "", false, false
	}
	nonNull = t.NonNull
	if t.NamedType != "" {
		// Simple named type (possibly NonNull): String!, UUID, AuthPayload!, etc.
		return t.NamedType, false, nonNull
	}
	// It's a list wrapper: [Foo!]  or  [Foo!]!
	inner := t.Elem
	if inner == nil {
		return "", false, nonNull
	}
	// Recurse into the list element
	elemName, _, _ := resolveTypeName(inner)
	return elemName, true, nonNull
}

func buildField(name string, t *ast.Type) *Field {
	typeName, isList, nonNull := resolveTypeName(t)
	return &Field{
		Name:     name,
		TypeName: typeName,
		IsList:   isList,
		NonNull:  nonNull,
	}
}

func buildOperation(f *ast.FieldDefinition, isMutation bool) *Operation {
	typeName, isList, nonNull := resolveTypeName(f.Type)
	op := &Operation{
		Name:       f.Name,
		IsMutation: isMutation,
		ReturnType: typeName,
		ReturnList: isList,
		ReturnNull: !nonNull,
	}

	for _, arg := range f.Arguments {
		argTypeName, _, argNonNull := resolveTypeName(arg.Type)
		op.Args = append(op.Args, &Argument{
			Name:     arg.Name,
			TypeName: argTypeName,
			NonNull:  argNonNull,
		})
	}
	return op
}

func unwrapTypeName(t *ast.Type) string {
	if t.NamedType != "" {
		return t.NamedType
	}
	if t.Elem != nil {
		return unwrapTypeName(t.Elem)
	}
	return ""
}
