// Package dart generates a Dart/Flutter GraphQL client SDK package from a
// parsed MasterFabric GraphQL schema.
//
// Output layout (under outputDir):
//
//	pubspec.yaml
//	lib/
//	  dart_go_api.dart            ← barrel export
//	  src/
//	    models/
//	      auth_payload.dart
//	      auth_user.dart
//	      user_profile.dart
//	      user_settings_payload.dart
//	      app_setting.dart
//	      enums.dart
//	      inputs.dart
//	    queries/
//	      auth_mutations.dart
//	      user_queries.dart
//	      user_mutations.dart
//	      settings_queries.dart
//	      settings_mutations.dart
//	    client/
//	      masterfabric_client.dart
package dart

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/masterfabric/masterfabric_go_basic/internal/codegen/parser"
)

// Generate is the top-level entry point called by the CLI.
// It parses all *.graphqls files from schemaDir and writes the Dart package to outputDir.
func Generate(schemaDir, outputDir string) error {
	schema, err := parser.LoadSchema(schemaDir)
	if err != nil {
		return fmt.Errorf("load schema: %w", err)
	}

	// Ensure output directories exist
	dirs := []string{
		filepath.Join(outputDir, "lib", "src", "models"),
		filepath.Join(outputDir, "lib", "src", "queries"),
		filepath.Join(outputDir, "lib", "src", "client"),
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
		{"pubspec.yaml", writePubspec},
		{"models/enums.dart", writeEnums},
		{"models/inputs.dart", writeInputs},
		{"models/objects.dart", writeObjects},
		{"queries/documents.dart", writeDocuments},
		{"client/masterfabric_client.dart", writeClient},
		{"lib/dart_go_api.dart (barrel)", writeBarrel},
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
