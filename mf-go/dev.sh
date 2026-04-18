#!/usr/bin/env bash
# =============================================================================
# dev.sh — MasterFabric Go Basic development helper
#
# Usage:
#   ./dev.sh [command]
#
# Commands:
#   setup        Install all required dev tools (air, golangci-lint)
#   env          Bootstrap .env from .env.example (skips if .env already exists)
#   infra        Start Postgres, Redis, RabbitMQ via Docker Compose
#   infra:down   Stop and remove infra containers
#   infra:status Show health of infra containers
#   infra:logs   Tail infra container logs
#   wait         Block until all infra services are healthy
#   generate     Re-run gqlgen code generation
#   build        Compile the server binary  →  bin/server
#   run          build + run the server (requires infra)
#   dev          Hot-reload with air (installs air if missing)
#   lint         Run golangci-lint
#   test         Run the full test suite with race detector
#   tidy         go mod tidy
#   clean        Remove build artifacts (bin/, tmp/)
#   reset        infra:down + remove Docker volumes (full wipe)
#   doctor       Verify every required tool is present
#   help         Print this help (default)
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/deployments/docker-compose.yml"
BINARY="${SCRIPT_DIR}/bin/server"
CMD_PKG="./cmd/server"

# GOPATH/bin may not be in $PATH (common on macOS with Homebrew Go).
# Always resolve go-installed binaries via their full path.
GOBIN="$(go env GOPATH)/bin"

# find_bin NAME — returns the full path to a binary, preferring GOBIN,
# then falling back to whatever is in $PATH, or empty string if not found.
find_bin() {
  local name="$1"
  if [[ -x "${GOBIN}/${name}" ]]; then
    echo "${GOBIN}/${name}"
  elif command -v "$name" &>/dev/null; then
    command -v "$name"
  else
    echo ""
  fi
}

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}==>${RESET} ${BOLD}$*${RESET}"; }
success() { echo -e "${GREEN}✔${RESET}  $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
error()   { echo -e "${RED}✘${RESET}  $*" >&2; }
die()     { error "$*"; exit 1; }

require() {
  local cmd="$1"
  local hint="${2:-install $cmd}"
  if ! command -v "$cmd" &>/dev/null; then
    die "'$cmd' is not installed. $hint"
  fi
}

compose() {
  require docker "Install Docker: https://docs.docker.com/get-docker/"
  docker compose -f "${COMPOSE_FILE}" "$@"
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_help() {
  grep -E '^#   [a-z]' "$0" | sed 's/^#   /  /'
  echo ""
  echo "  Run without arguments to see this help."
}

cmd_doctor() {
  info "Checking required tools..."
  local ok=true

  # check_gobin NAME HINT — for tools installed via `go install`
  # reads version from embedded build info (no process started)
  check_gobin() {
    local tool="$1"
    local hint="$2"
    local bin
    bin=$(find_bin "$tool")
    if [[ -n "$bin" ]]; then
      local ver
      ver=$(go version -m "$bin" 2>/dev/null | awk '/^\tmod/{print $3}' | head -1)
      success "$tool  ($ver)"
    else
      warn "$tool — NOT FOUND  ($hint)"
      ok=false
    fi
  }

  # check_cmd NAME HINT VER_CMD — for system binaries with a --version flag
  check_cmd() {
    local tool="$1"
    local hint="$2"
    local ver_cmd="$3"
    if command -v "$tool" &>/dev/null; then
      local ver
      ver=$( $tool $ver_cmd 2>&1 | head -1 )
      success "$tool  ($ver)"
    else
      warn "$tool — NOT FOUND  ($hint)"
      ok=false
    fi
  }

  check_cmd  go            "https://go.dev/dl/"                  "version"
  check_cmd  docker        "https://docs.docker.com/get-docker/" "--version"
  check_gobin air           "run: ./dev.sh setup"
  check_gobin golangci-lint "run: ./dev.sh setup"

  # Docker daemon
  if command -v docker &>/dev/null; then
    if docker info &>/dev/null 2>&1; then
      success "docker daemon — running"
    else
      warn "docker daemon — NOT RUNNING"
      ok=false
    fi
  fi

  # .env file
  if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    success ".env — found"
  else
    warn ".env — NOT FOUND  (run: ./dev.sh env)"
    ok=false
  fi

  if $ok; then
    echo ""
    success "All checks passed."
  else
    echo ""
    warn "Some checks failed. Run './dev.sh setup' to fix missing tools."
    return 1
  fi
}

cmd_setup() {
  info "Installing dev tools..."
  require go "https://go.dev/dl/"

  # ── air (hot-reload) ───────────────────────────────────────────────────────
  local air_bin
  air_bin=$(find_bin air)
  if [[ -z "$air_bin" ]]; then
    info "Installing air..."
    go install github.com/air-verse/air@latest
    air_bin="${GOBIN}/air"
    local air_ver
    air_ver=$("$air_bin" -v 2>&1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    success "air installed  ($air_ver)"
  else
    local air_ver
    air_ver=$("$air_bin" -v 2>&1 | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    success "air already installed  ($air_ver)"
  fi

  # ── golangci-lint ──────────────────────────────────────────────────────────
  local lint_bin
  lint_bin=$(find_bin golangci-lint)
  if [[ -z "$lint_bin" ]]; then
    info "Installing golangci-lint..."
    curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh \
      | sh -s -- -b "${GOBIN}" latest
    lint_bin="${GOBIN}/golangci-lint"
    success "golangci-lint installed  ($("$lint_bin" --version 2>&1 | head -1))"
  else
    success "golangci-lint already installed  ($("$lint_bin" --version 2>&1 | head -1))"
  fi

  echo ""
  success "Setup complete. Tip: add '${GOBIN}' to your PATH to use these tools directly."
}

cmd_env() {
  if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    warn ".env already exists — skipping. Delete it and re-run to reset."
    return 0
  fi

  if [[ ! -f "${SCRIPT_DIR}/.env.example" ]]; then
    die ".env.example not found."
  fi

  cp "${SCRIPT_DIR}/.env.example" "${SCRIPT_DIR}/.env"
  success ".env created from .env.example"
  warn "Review ${SCRIPT_DIR}/.env and update secrets (especially JWT_SECRET) before use."
}

cmd_infra() {
  info "Starting infra services (postgres, redis, rabbitmq)..."
  compose up -d postgres redis rabbitmq
  success "Infra containers started. Run './dev.sh wait' to block until healthy."
}

cmd_infra_down() {
  info "Stopping infra containers..."
  compose down
  success "Infra containers stopped."
}

cmd_infra_status() {
  info "Infra container status:"
  compose ps postgres redis rabbitmq
}

cmd_infra_logs() {
  local svc="${1:-}"
  if [[ -n "$svc" ]]; then
    compose logs -f "$svc"
  else
    compose logs -f postgres redis rabbitmq
  fi
}

cmd_wait() {
  require docker "Install Docker: https://docs.docker.com/get-docker/"

  info "Waiting for infra services to become healthy..."

  wait_for() {
    local name="$1"
    local max=30
    local i=0
    while [[ $i -lt $max ]]; do
      local status
      status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "missing")
      if [[ "$status" == "healthy" ]]; then
        success "$name is healthy"
        return 0
      fi
      echo -ne "  waiting for ${name} (${status})...\r"
      sleep 2
      ((i++))
    done
    die "Timed out waiting for $name to become healthy."
  }

  wait_for mf_postgres
  wait_for mf_redis
  wait_for mf_rabbitmq

  echo ""
  success "All infra services are healthy."
}

cmd_generate() {
  require go "https://go.dev/dl/"
  info "Running gqlgen code generation..."
  cd "${SCRIPT_DIR}"
  go run github.com/99designs/gqlgen generate --config gqlgen.yml
  success "gqlgen generation complete."
}

cmd_build() {
  require go "https://go.dev/dl/"
  info "Building server binary → bin/server"
  mkdir -p "${SCRIPT_DIR}/bin"
  cd "${SCRIPT_DIR}"
  CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "${BINARY}" "${CMD_PKG}"
  success "Build complete: ${BINARY}"
}

cmd_run() {
  cmd_build

  # Load .env if present
  if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    info "Loading environment from .env"
    set -o allexport
    # shellcheck disable=SC1090
    source "${SCRIPT_DIR}/.env"
    set +o allexport
  else
    warn ".env not found — using defaults baked into the binary."
  fi

  info "Starting server..."
  exec "${BINARY}"
}

cmd_dev() {
  require go "https://go.dev/dl/"

  # Resolve air — install if not present
  local air_bin
  air_bin=$(find_bin air)
  if [[ -z "$air_bin" ]]; then
    warn "air not found — installing now..."
    go install github.com/air-verse/air@latest
    air_bin="${GOBIN}/air"
    success "air installed."
  fi

  # Load .env if present
  if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    info "Loading environment from .env"
    set -o allexport
    # shellcheck disable=SC1090
    source "${SCRIPT_DIR}/.env"
    set +o allexport
  else
    warn ".env not found — using defaults baked into the binary."
  fi

  info "Starting hot-reload with air..."
  cd "${SCRIPT_DIR}"
  exec "$air_bin" -c .air.toml
}

cmd_lint() {
  local lint_bin
  lint_bin=$(find_bin golangci-lint)
  if [[ -z "$lint_bin" ]]; then
    warn "golangci-lint not found — run './dev.sh setup' to install. Falling back to 'go vet'."
    cd "${SCRIPT_DIR}"
    go vet ./...
    success "go vet passed (golangci-lint not installed)."
    return 0
  fi

  info "Running golangci-lint..."
  cd "${SCRIPT_DIR}"
  "$lint_bin" run ./...
  success "Lint passed."
}

cmd_test() {
  require go "https://go.dev/dl/"
  info "Running tests (race detector on)..."
  cd "${SCRIPT_DIR}"
  go test -race -count=1 -timeout=120s ./...
  success "All tests passed."
}

cmd_tidy() {
  require go "https://go.dev/dl/"
  info "Running go mod tidy..."
  cd "${SCRIPT_DIR}"
  go mod tidy
  success "go.mod and go.sum are tidy."
}

cmd_clean() {
  info "Cleaning build artifacts..."
  rm -rf "${SCRIPT_DIR}/bin" "${SCRIPT_DIR}/tmp"
  success "Removed bin/ and tmp/."
}

cmd_reset() {
  warn "This will stop all containers AND delete all Docker volumes (database data will be lost)."
  read -r -p "Are you sure? [y/N] " confirm
  if [[ "${confirm,,}" != "y" ]]; then
    info "Reset cancelled."
    return 0
  fi

  info "Tearing down containers and volumes..."
  compose down --volumes --remove-orphans
  success "All containers and volumes removed."
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
COMMAND="${1:-help}"

case "$COMMAND" in
  setup)         cmd_setup ;;
  env)           cmd_env ;;
  infra)         cmd_infra ;;
  infra:down)    cmd_infra_down ;;
  infra:status)  cmd_infra_status ;;
  infra:logs)    cmd_infra_logs "${2:-}" ;;
  wait)          cmd_wait ;;
  generate)      cmd_generate ;;
  build)         cmd_build ;;
  run)           cmd_run ;;
  dev)           cmd_dev ;;
  lint)          cmd_lint ;;
  test)          cmd_test ;;
  tidy)          cmd_tidy ;;
  clean)         cmd_clean ;;
  reset)         cmd_reset ;;
  doctor)        cmd_doctor ;;
  help|--help|-h) cmd_help ;;
  *)
    error "Unknown command: '$COMMAND'"
    echo ""
    cmd_help
    exit 1
    ;;
esac
