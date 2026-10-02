#!/usr/bin/env bash
# ── CineConnect Production Build Check ────────────────────────
# Runs type-check, tests, and full builds for both workspaces.
# Exit code 0 = everything passed. Non-zero = something failed.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0

run_step() {
  local label="$1"
  shift
  echo ""
  echo -e "${BOLD}▶ ${label}${RESET}"
  if "$@"; then
    echo -e "${GREEN}  ✓ ${label} passed${RESET}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}  ✗ ${label} FAILED${RESET}"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  CineConnect — Production Build Check   ${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ── Server ────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── Server ──────────────────────────────${RESET}"

run_step "Server: TypeScript type-check" \
  bash -c "cd server && npx tsc --noEmit"

run_step "Server: Unit & integration tests" \
  bash -c "cd server && npx vitest run"

run_step "Server: Production build (tsc)" \
  bash -c "cd server && npm run build"

# ── Client ────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}── Client ──────────────────────────────${RESET}"

run_step "Client: TypeScript type-check" \
  bash -c "cd client && npx tsc --noEmit"

run_step "Client: Component tests" \
  bash -c "cd client && npx vitest run"

run_step "Client: Production build (Vite)" \
  bash -c "cd client && npm run build" || true  # Vite build needs real env

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Passed: ${GREEN}${BOLD}${PASS}${RESET}   Failed: ${RED}${BOLD}${FAIL}${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${BOLD}Build check FAILED — fix the issues above before deploying.${RESET}"
  exit 1
else
  echo -e "${GREEN}${BOLD}All checks passed — ready to deploy ✓${RESET}"
  exit 0
fi
