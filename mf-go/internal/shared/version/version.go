// Package version holds generic build metadata for the API binary.
//
// Default semver comes from semver.txt on main (updated by mf-go Auto Version).
// Operator guide: .github/CICD-RELEASE.md
// Override at link time with -ldflags, or at runtime with MF_BUILD_VERSION / MF_SERVICE_NAME.
package version

import (
	_ "embed"
	"os"
	"strings"
)

//go:embed semver.txt
var embeddedSemver string

// Version is the API binary / build version (distinct from productRelease in the database).
var Version = "0.1.0"

// ServiceName identifies this deployment in logs and health payloads.
var ServiceName = "masterfabric-go"

// Commit is optional VCS revision (set via -ldflags).
var Commit = ""

// BuildTime is optional ISO8601 build timestamp (set via -ldflags).
var BuildTime = ""

func init() {
	if v := strings.TrimSpace(embeddedSemver); v != "" {
		Version = v
	}
	if v := os.Getenv("MF_BUILD_VERSION"); v != "" {
		Version = v
	}
	if s := os.Getenv("MF_SERVICE_NAME"); s != "" {
		ServiceName = s
	}
}
