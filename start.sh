#!/usr/bin/env bash
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI="$REPO_ROOT/ai-service"
FRONTEND="$REPO_ROOT/frontend"
VENV_PY="$AI/.venv/bin/python"

if [ ! -x "$VENV_PY" ]; then
  echo "!! $VENV_PY not found. Run: bash install.sh"
  exit 1
fi

LOG_API="$AI/uvicorn.out"
LOG_FE="$FRONTEND/frontend.out"

API_PID=""
FE_PID=""
QPID=""

cleanup() {
  echo ""
  echo "==> Stopping services"
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$FE_PID"  ] && kill "$FE_PID"  2>/dev/null || true
  if ! curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1; then :; fi
  [ -n "$QPID" ] && kill "$QPID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 1. Qdrant (reuse if already running).
if curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1; then
  echo "==> Qdrant already on :6333"
else
  QBIN=""
  for cand in "$AI/data/qdrant/bin/qdrant.exe" "$AI/data/qdrant/bin/qdrant"; do
    [ -x "$cand" ] && QBIN="$cand" && break
  done
  [ -z "$QBIN" ] && command -v qdrant >/dev/null 2>&1 && QBIN="$(command -v qdrant)"
  if [ -z "$QBIN" ]; then
    echo "!! No qdrant binary found."
    exit 1
  fi
  echo "==> Starting Qdrant: $QBIN"
  "$QBIN" --config-path "$AI/data/qdrant/config/config.yaml" \
      >"$AI/qdrant.out" 2>"$AI/qdrant.err" &
  QPID=$!
  for _ in $(seq 1 60); do
    curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1 && break
    sleep 0.5
  done
  if ! curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1; then
    echo "!! Qdrant failed to start. See $AI/qdrant.err"
    exit 1
  fi
fi

# 2. FastAPI.
echo "==> Starting FastAPI on :8000 (logs: $LOG_API)"
( cd "$AI" && "$VENV_PY" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 \
    >"$LOG_API" 2>&1 ) &
API_PID=$!

# 3. Frontend. Use python's http.server with an explicit --directory so the cwd is reliable.
echo "==> Starting frontend on :5500 (logs: $LOG_FE)"
PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || PY=python
( cd "$FRONTEND" && "$PY" -m http.server 127.0.0.1 --directory "$FRONTEND" 5500 \
    >"$LOG_FE" 2>&1 ) &
FE_PID=$!

# 4. Wait for /v1/health.
echo "==> Waiting for /v1/health"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8000/v1/health >/dev/null 2>&1; then
    echo "    FastAPI is healthy"
    break
  fi
  sleep 0.5
done
if ! curl -fsS http://127.0.0.1:8000/v1/health >/dev/null 2>&1; then
  echo "!! FastAPI did not become healthy. Tail of $LOG_API:"
  tail -n 40 "$LOG_API" || true
  exit 1
fi

# 5. Open browser.
URL="http://127.0.0.1:5500/"
echo "==> Opening $URL"
if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v open   >/dev/null 2>&1; then open   "$URL" >/dev/null 2>&1 || true
elif command -v start  >/dev/null 2>&1; then start  "$URL" >/dev/null 2>&1 || true
fi

echo ""
echo "AIBridge is running."
echo "  Frontend : http://127.0.0.1:5500/"
echo "  API docs : http://127.0.0.1:8000/docs"
echo "  Health   : http://127.0.0.1:8000/v1/health"
echo ""
echo "Press Ctrl+C to stop everything."
wait
