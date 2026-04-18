// Package typescript generates a TypeScript/Node.js GraphQL client SDK from a
// parsed MasterFabric GraphQL schema.
//
// Output layout (under outputDir):
//
//	package.json
//	tsconfig.json
//	src/
//	  models/
//	    enums.ts
//	    inputs.ts
//	    models.ts
//	  queries/
//	    documents.ts
//	  client/
//	    MasterFabricClient.ts
//	  index.ts
package typescript

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/masterfabric/masterfabric_go_basic/internal/codegen/parser"
)

// Generate is the top-level entry point called by the CLI.
// It parses all *.graphqls files from schemaDir and writes the TypeScript package to outputDir.
func Generate(schemaDir, outputDir string) error {
	schema, err := parser.LoadSchema(schemaDir)
	if err != nil {
		return fmt.Errorf("load schema: %w", err)
	}

	// Ensure output directories exist
	dirs := []string{
		filepath.Join(outputDir, "src", "models"),
		filepath.Join(outputDir, "src", "queries"),
		filepath.Join(outputDir, "src", "client"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return fmt.Errorf("mkdir %s: %w", d, err)
		}
	}

	steps := []struct {
		name string
		fn   func(*parser.Schema, string) error
	}{
		{"package.json", writePackageJSON},
		{"tsconfig.json", writeTsConfig},
		{"src/models/enums.ts", writeEnums},
		{"src/models/inputs.ts", writeInputs},
		{"src/models/models.ts", writeModels},
		{"src/queries/documents.ts", writeDocuments},
		{"src/client/MasterFabricClient.ts", writeClient},
		{"src/index.ts (barrel)", writeBarrel},
	}

	for _, step := range steps {
		fmt.Printf("  ► %s\n", step.name)
		if err := step.fn(schema, outputDir); err != nil {
			return fmt.Errorf("%s: %w", step.name, err)
		}
	}

	return nil
}

// writeFile is a helper that creates or truncates a file and writes content to it.
func writeFile(path, content string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0o644)
}
