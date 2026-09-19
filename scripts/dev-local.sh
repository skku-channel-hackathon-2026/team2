#!/usr/bin/env bash
#
# Run the whole team2 stack locally.
#
#   scripts/dev-local.sh               build, migrate D1, serve on Workers, smoke, stay up
#   scripts/dev-local.sh --check       run the pre-merge gate first, then serve
#   scripts/dev-local.sh --check-only  run the pre-merge gate and exit
#   scripts/dev-local.sh --wam         also start the Vite WAM dev server
#   scripts/dev-local.sh --no-smoke    skip the smoke test
#   scripts/dev-local.sh --install     force pnpm install --frozen-lockfile
#   scripts/dev-local.sh --port 8797   override the Workers port
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-8797}"
WAM_PORT="${WAM_PORT:-5173}"
run_checks=0
check_only=0
run_wam=0
run_smoke=1
force_install=0

usage() { sed -n '2,12p' "$0" | sed 's/^#\{1,\} \{0,1\}//'; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) run_checks=1 ;;
    --check-only) run_checks=1; check_only=1 ;;
    --wam) run_wam=1 ;;
    --no-smoke) run_smoke=0 ;;
    --install) force_install=1 ;;
    --port) PORT="${2:?--port needs a value}"; shift ;;
    --wam-port) WAM_PORT="${2:?--wam-port needs a value}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'unknown option: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

if command -v pnpm >/dev/null 2>&1; then
  PNPM=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  PNPM=(corepack pnpm)
else
  die "pnpm not found. Install Node 24+ and run: corepack enable"
fi

command -v node >/dev/null 2>&1 || die "node not found (Node 24+ required)"
[[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 24 ]] \
  || die "Node 24+ required, found $(node -v)"

# --- fake local credentials -------------------------------------------------
# Workers dev needs these. They are deliberately fake: a local run cannot reach
# the real Channel API. SIGNING_KEY must stay 0x11 x32 or the smoke test fails.
if [[ ! -f .dev.vars ]]; then
  step "Creating .dev.vars (fake local credentials, gitignored)"
  cat > .dev.vars <<'VARS_EOF'
APP_ID=local-test-app
APP_SECRET=local-test-secret
SIGNING_KEY=1111111111111111111111111111111111111111111111111111111111111111
APP_STORE_URL=https://app-store-api.channel.io
VARS_EOF
  info "wrote .dev.vars"
fi

if [[ ! -d node_modules || "$force_install" -eq 1 ]]; then
  step "Installing dependencies"
  "${PNPM[@]}" install --frozen-lockfile
fi

# CLAUDE.md's pre-merge gate: typecheck && test && lint && build:cloudflare.
if [[ "$run_checks" -eq 1 ]]; then
  for task in typecheck test lint; do
    step "$task"
    "${PNPM[@]}" "$task"
  done
  # Advisory only. format:check is not part of the gate, and several markdown
  # files are already unformatted on main, so it would always fail here.
  step "format:check (advisory)"
  if "${PNPM[@]}" format:check; then
    info "formatting clean"
  else
    info "unformatted files above; fix yours with: ${PNPM[*]} exec prettier --write <file>"
  fi
fi

step "Building (shared -> server + wam -> cloudflare/static)"
"${PNPM[@]}" build:cloudflare

if [[ "$check_only" -eq 1 ]]; then
  printf '\n\033[1;32mPre-merge gate passed: typecheck, test, lint, build.\033[0m\n'
  exit 0
fi

# Call the real binaries, not `pnpm exec`: pnpm adds two wrapper processes that
# swallow SIGTERM, which leaves orphaned wrangler/workerd holding the port.
WRANGLER="$ROOT/node_modules/.bin/wrangler"
[[ -x "$WRANGLER" ]] || die "wrangler not found. Run: ${PNPM[*]} install --frozen-lockfile"

step "Applying D1 migrations to the local database"
"$WRANGLER" d1 migrations apply DB --local </dev/null

# --- background processes ---------------------------------------------------
server_pid=""
wam_pid=""

kill_tree() {
  local pid="$1" sig="${2:-TERM}" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child" "$sig"
  done
  kill -"$sig" "$pid" 2>/dev/null || true
}

alive() {
  local pid
  for pid in "$@"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then return 0; fi
  done
  return 1
}

cleanup() {
  trap - EXIT INT TERM
  step "Shutting down"
  for pid in "$wam_pid" "$server_pid"; do
    [[ -n "$pid" ]] && kill_tree "$pid" TERM || true
  done
  for _ in $(seq 1 20); do
    alive "$wam_pid" "$server_pid" || break
    sleep 0.5
  done
  for pid in "$wam_pid" "$server_pid"; do
    [[ -n "$pid" ]] && kill_tree "$pid" KILL || true
  done
  info "stopped"
}
trap cleanup EXIT INT TERM

step "Starting Workers runtime on http://127.0.0.1:$PORT"
"$WRANGLER" dev --local --port "$PORT" &
server_pid=$!

printf '    waiting for /api/ready '
ready=0
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:$PORT/api/ready" >/dev/null 2>&1; then
    ready=1
    break
  fi
  kill -0 "$server_pid" 2>/dev/null || die "wrangler dev exited before becoming ready"
  printf '.'
  sleep 1
done
printf '\n'
[[ "$ready" -eq 1 ]] || die "server did not become ready on port $PORT"
info "ready"

if [[ "$run_smoke" -eq 1 ]]; then
  step "Smoke test"
  SMOKE_ORIGIN="http://127.0.0.1:$PORT" node scripts/smoke-cloudflare.mjs
fi

if [[ "$run_wam" -eq 1 ]]; then
  step "Starting WAM dev server on http://127.0.0.1:$WAM_PORT"
  ( cd "$ROOT/wam" && exec node_modules/.bin/vite --port "$WAM_PORT" --strictPort ) &
  wam_pid=$!
fi

printf '\n\033[1;32mRunning.\033[0m Ctrl+C to stop.\n\n'
printf '  Health            http://127.0.0.1:%s/api/health\n' "$PORT"
printf '  Ready (D1 ping)   http://127.0.0.1:%s/api/ready\n' "$PORT"
printf '  Function endpoint http://127.0.0.1:%s/functions\n' "$PORT"
printf '  WAM (built)       http://127.0.0.1:%s/resource/wam/tutorial/\n' "$PORT"
if [[ "$run_wam" -eq 1 ]]; then
  printf '  WAM (Vite HMR)    http://127.0.0.1:%s/\n' "$WAM_PORT"
fi

cat <<'NOTE_EOF'

  Note: opening either WAM URL in a plain browser has no window.ChannelIOWam,
  so host data is missing and the UI shows its error banner with the buttons
  disabled. Layout only. Real send paths need Channel Desk on a deployed build.
NOTE_EOF

while alive "$server_pid" "$wam_pid"; do
  sleep 1
done
