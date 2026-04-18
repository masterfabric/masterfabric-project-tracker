# Plan: Add New SDK Target

## Overview
Step-by-step plan for adding a new mobile/client SDK code generation target (e.g., Kotlin, TypeScript) to the MasterFabric CLI.

## Steps

### 1. Create Generator Package
- [ ] Create directory: `internal/codegen/<target>/`
- [ ] Create `generator.go` — `Generate(schemaDir, outputDir string) error` entry point
  - Parse schema via `parser.ParseSchema(schemaDir)`
  - Create output directory
  - Orchestrate sub-generators
- [ ] Create `models.go` — generate model/enum/input types
- [ ] Create `queries.go` — generate operation constants / DocumentNodes
- [ ] Create `client.go` — generate typed API client

### 2. Register CLI Command
- [ ] Add cobra subcommand in `cmd/masterfabric_go/main.go`
  ```go
  var generate<Target>Cmd = &cobra.Command{
      Use:   "<target>",
      Short: "Generate <Target> SDK",
      RunE:  func(cmd *cobra.Command, args []string) error {
          return <target>.Generate(schemaDir, outputDir)
      },
  }
  ```
- [ ] Register under `generateCmd`: `generateCmd.AddCommand(generate<Target>Cmd)`

### 3. Makefile
- [ ] Add `generate-<target>` target
  ```makefile
  generate-<target>: build-cli
      ./bin/masterfabric_go generate <target> \
        --schema internal/infrastructure/graphql/schema \
        --output sdk/<target>_go_api
  ```
- [ ] Add `generate-<target>` to `generate-all` target

### 4. Output SDK Structure
- [ ] Define and create output directory layout under `sdk/<target>_go_api/`
- [ ] Add `# GENERATED — do not edit by hand` header to all generated files
- [ ] Add `sdk/<target>_go_api/` to `.gitignore` if desired (or commit generated output)

### 5. Testing
- [ ] Run `make build-cli` — CLI must compile
- [ ] Run `make generate-<target>` — output files must be created
- [ ] Manually verify output structure matches expected SDK layout

## Verification
```bash
make build-cli
make generate-<target>
ls sdk/<target>_go_api/
```
