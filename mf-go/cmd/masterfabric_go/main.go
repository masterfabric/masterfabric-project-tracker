// masterfabric_go — code-generation CLI for the MasterFabric platform.
//
// Usage:
//
//	masterfabric_go generate dart        — generate sdk/dart_go_api Dart package
//	masterfabric_go generate swift       — generate sdk/swift_go_api Swift package
//	masterfabric_go generate kotlin      — generate sdk/kotlin_go_api Kotlin/Android package
//	masterfabric_go generate typescript  — generate sdk/typescript_go_api TypeScript package
package main

import (
	"fmt"
	"os"

	"github.com/masterfabric/masterfabric_go_basic/internal/codegen/dart"
	"github.com/masterfabric/masterfabric_go_basic/internal/codegen/kotlin"
	"github.com/masterfabric/masterfabric_go_basic/internal/codegen/swift"
	"github.com/masterfabric/masterfabric_go_basic/internal/codegen/typescript"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{
		Use:   "masterfabric_go",
		Short: "MasterFabric code-generation CLI",
		Long: `masterfabric_go is the code-generation tool for the MasterFabric Go backend.

It reads the GraphQL schema files and generates typed client SDK packages
for supported target platforms.`,
	}

	generate := &cobra.Command{
		Use:   "generate",
		Short: "Generate SDK packages from the GraphQL schema",
	}

	// ── Phase 1: Dart ─────────────────────────────────────────────────────────
	var (
		schemaDir string
		outputDir string
	)

	dartCmd := &cobra.Command{
		Use:   "dart",
		Short: "Generate a Dart/Flutter GraphQL client package (sdk/dart_go_api)",
		Long: `Reads all *.graphqls files from the schema directory and emits a complete
Dart package under sdk/dart_go_api ready to be dropped into any Flutter project.

Generated package includes:
  • pubspec.yaml
  • lib/src/models/       — Dart model classes with fromJson / toJson
  • lib/src/queries/      — gql() DocumentNode constants
  • lib/src/client/       — typed GraphQL API client (graphql package)
  • lib/dart_go_api.dart  — barrel export`,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("masterfabric_go: generating Dart package...")
			if err := dart.Generate(schemaDir, outputDir); err != nil {
				return fmt.Errorf("dart generation failed: %w", err)
			}
			fmt.Printf("masterfabric_go: Dart package written to %s\n", outputDir)
			return nil
		},
	}

	dartCmd.Flags().StringVar(&schemaDir, "schema", "internal/infrastructure/graphql/schema", "Directory containing *.graphqls files")
	dartCmd.Flags().StringVar(&outputDir, "output", "sdk/dart_go_api", "Output directory for the generated Dart package")

	// ── Phase 2: Swift ────────────────────────────────────────────────────────
	var (
		swiftSchemaDir string
		swiftOutputDir string
	)

	swiftCmd := &cobra.Command{
		Use:   "swift",
		Short: "Generate a Swift/iOS GraphQL client package (sdk/swift_go_api)",
		Long: `Reads all *.graphqls files from the schema directory and emits a complete
Swift Package Manager package under sdk/swift_go_api ready to be added to any
iOS/macOS Xcode project via File > Add Package Dependencies.

Generated package includes:
  • Package.swift                   — SPM manifest (Apollo iOS dependency)
  • Sources/MasterFabricAPI/Models/ — Codable structs, enums, input types
  • Sources/MasterFabricAPI/Queries/ — GraphQL operation string constants
  • Sources/MasterFabricAPI/Client/ — typed async/await API client`,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("masterfabric_go: generating Swift package...")
			if err := swift.Generate(swiftSchemaDir, swiftOutputDir); err != nil {
				return fmt.Errorf("swift generation failed: %w", err)
			}
			fmt.Printf("masterfabric_go: Swift package written to %s\n", swiftOutputDir)
			return nil
		},
	}

	swiftCmd.Flags().StringVar(&swiftSchemaDir, "schema", "internal/infrastructure/graphql/schema", "Directory containing *.graphqls files")
	swiftCmd.Flags().StringVar(&swiftOutputDir, "output", "sdk/swift_go_api", "Output directory for the generated Swift package")

	generate.AddCommand(dartCmd, swiftCmd)

	// ── Phase 3: Kotlin ───────────────────────────────────────────────────────
	var (
		kotlinSchemaDir string
		kotlinOutputDir string
	)

	kotlinCmd := &cobra.Command{
		Use:   "kotlin",
		Short: "Generate a Kotlin/Android GraphQL client package (sdk/kotlin_go_api)",
		Long: `Reads all *.graphqls files from the schema directory and emits a complete
Kotlin Android library package under sdk/kotlin_go_api, ready to be added to
any Android project via a local Gradle dependency.

Generated package includes:
  • build.gradle.kts                      — Android library Gradle build file
  • src/main/kotlin/com/masterfabric/api/
      models/                             — Enums, data classes for inputs and objects
      queries/                            — GraphQL operation string constants
      client/                             — typed coroutine API client (OkHttp + Gson)`,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("masterfabric_go: generating Kotlin package...")
			if err := kotlin.Generate(kotlinSchemaDir, kotlinOutputDir); err != nil {
				return fmt.Errorf("kotlin generation failed: %w", err)
			}
			fmt.Printf("masterfabric_go: Kotlin package written to %s\n", kotlinOutputDir)
			return nil
		},
	}

	kotlinCmd.Flags().StringVar(&kotlinSchemaDir, "schema", "internal/infrastructure/graphql/schema", "Directory containing *.graphqls files")
	kotlinCmd.Flags().StringVar(&kotlinOutputDir, "output", "sdk/kotlin_go_api", "Output directory for the generated Kotlin package")

	// ── Phase 4: TypeScript ───────────────────────────────────────────────────
	var (
		tsSchemaDir string
		tsOutputDir string
	)

	tsCmd := &cobra.Command{
		Use:   "typescript",
		Short: "Generate a TypeScript/Node.js GraphQL client package (sdk/typescript_go_api)",
		Long: `Reads all *.graphqls files from the schema directory and emits a complete
TypeScript npm package under sdk/typescript_go_api, ready to be published to npm
or used directly in any Node.js / browser project.

Generated package includes:
  • package.json / tsconfig.json
  • src/models/       — TypeScript interfaces for enums, inputs, and output types
  • src/queries/      — GraphQL operation string constants
  • src/client/       — typed async/await API client (native fetch)
  • src/index.ts      — barrel export`,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Println("masterfabric_go: generating TypeScript package...")
			if err := typescript.Generate(tsSchemaDir, tsOutputDir); err != nil {
				return fmt.Errorf("typescript generation failed: %w", err)
			}
			fmt.Printf("masterfabric_go: TypeScript package written to %s\n", tsOutputDir)
			return nil
		},
	}

	tsCmd.Flags().StringVar(&tsSchemaDir, "schema", "internal/infrastructure/graphql/schema", "Directory containing *.graphqls files")
	tsCmd.Flags().StringVar(&tsOutputDir, "output", "sdk/typescript_go_api", "Output directory for the generated TypeScript package")

	generate.AddCommand(kotlinCmd, tsCmd)
	root.AddCommand(generate)

	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
