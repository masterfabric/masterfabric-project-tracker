// Package swift generates a Swift/iOS GraphQL client SDK package from a
// parsed MasterFabric GraphQL schema.
//
// Output layout (under outputDir):
//
//	Package.swift
//	Sources/
//	  MasterFabricAPI/
//	    Models/
//	      Enums.swift
//	      Inputs.swift
//	      Models.swift
//	    Queries/
//	      Documents.swift
//	    Client/
//	      MasterFabricClient.swift
package swift

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/masterfabric/masterfabric_go_basic/internal/codegen/parser"
)

// Generate is the top-level entry point called by the CLI.
// It parses all *.graphqls files from schemaDir and writes the Swift package to outputDir.
func Generate(schemaDir, outputDir string) error {
	schema, err := parser.LoadSchema(schemaDir)
	if err != nil {
		return fmt.Errorf("load schema: %w", err)
	}

	// Ensure output directories exist
	dirs := []string{
		filepath.Join(outputDir, "Sources", "MasterFabricAPI", "Models"),
		filepath.Join(outputDir, "Sources", "MasterFabricAPI", "Queries"),
		filepath.Join(outputDir, "Sources", "MasterFabricAPI", "Client"),
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
		{"Package.swift", writePackageManifest},
		{"Models/Enums.swift", writeEnums},
		{"Models/Inputs.swift", writeInputs},
		{"Models/Models.swift", writeModels},
		{"Queries/Documents.swift", writeDocuments},
		{"Client/MasterFabricClient.swift", writeClient},
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
