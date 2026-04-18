// Package kotlin generates a Kotlin/Android GraphQL client SDK from a
// parsed MasterFabric GraphQL schema.
//
// Output layout (under outputDir):
//
//	build.gradle.kts
//	src/main/kotlin/com/masterfabric/api/
//	  models/
//	    Enums.kt
//	    Inputs.kt
//	    Models.kt
//	  queries/
//	    Documents.kt
//	  client/
//	    MasterFabricClient.kt
package kotlin

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/masterfabric/masterfabric_go_basic/internal/codegen/parser"
)

const srcRoot = "src/main/kotlin/com/masterfabric/api"

// Generate is the top-level entry point called by the CLI.
// It parses all *.graphqls files from schemaDir and writes the Kotlin package to outputDir.
func Generate(schemaDir, outputDir string) error {
	schema, err := parser.LoadSchema(schemaDir)
	if err != nil {
		return fmt.Errorf("load schema: %w", err)
	}

	// Ensure output directories exist
	dirs := []string{
		filepath.Join(outputDir, srcRoot, "models"),
		filepath.Join(outputDir, srcRoot, "queries"),
		filepath.Join(outputDir, srcRoot, "client"),
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
		{"build.gradle.kts", writeBuildGradle},
		{"models/Enums.kt", writeEnums},
		{"models/Inputs.kt", writeInputs},
		{"models/Models.kt", writeModels},
		{"queries/Documents.kt", writeDocuments},
		{"client/MasterFabricClient.kt", writeClient},
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
