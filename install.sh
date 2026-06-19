#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI="$REPO_ROOT/ai-service"

PY="${PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then PY=python; fi

VENV="$AI/.venv"
VENV_PY="$VENV/bin/python"
VENV_PIP="$VENV/bin/pip"

echo "==> Repo root: $REPO_ROOT"
echo "==> Python:    $($PY --version 2>&1)"

# 1. Create venv + install requirements.
if [ ! -x "$VENV_PY" ]; then
  echo "==> Creating venv at $VENV"
  "$PY" -m venv "$VENV"
fi
echo "==> Upgrading pip"
"$VENV_PY" -m pip install --upgrade pip wheel setuptools >/dev/null
echo "==> Installing requirements"
"$VENV_PY" -m pip install -r "$AI/requirements.txt"

# 2. Seed .env if missing.
if [ ! -f "$AI/.env" ]; then
  echo "==> Creating .env from .env.example"
  cp "$AI/.env.example" "$AI/.env"
  echo "    Add a real GROQ_API_KEYS to $AI/.env before running heavy workloads."
fi

# 3. Boot Qdrant briefly so we can initialise the collections.
QDRANT_RUNNING=0
if curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1; then
  QDRANT_RUNNING=1
  echo "==> Qdrant already running on :6333"
else
  QBIN=""
  for cand in \
      "$AI/data/qdrant/bin/qdrant.exe" \
      "$AI/data/qdrant/bin/qdrant"; do
    [ -x "$cand" ] && QBIN="$cand" && break
  done
  if [ -z "$QBIN" ] && command -v qdrant >/dev/null 2>&1; then
    QBIN="$(command -v qdrant)"
  fi
  if [ -z "$QBIN" ]; then
    echo "!! Could not find a qdrant binary. Expected one of:"
    echo "     $AI/data/qdrant/bin/qdrant(.exe)"
    echo "     or 'qdrant' on PATH"
    exit 1
  fi
  echo "==> Starting Qdrant: $QBIN"
  "$QBIN" --config-path "$AI/data/qdrant/config/config.yaml" \
      >"$AI/qdrant.out" 2>"$AI/qdrant.err" &
  QPID=$!
  for _ in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1; then
      echo "    up"
      break
    fi
    sleep 0.5
  done
  if ! curl -fsS http://127.0.0.1:6333/collections >/dev/null 2>&1; then
    echo "!! Qdrant did not come up in 30s. See $AI/qdrant.err"
    exit 1
  fi
  trap 'kill "$QPID" 2>/dev/null || true' EXIT INT TERM
fi

# 4. Initialise collections + payload indexes.
echo "==> Initialising Qdrant collections"
"$VENV_PY" "$AI/scripts/init_qdrant.py"

# 5. Download the embedding model if missing.
MODEL_DIR="$AI/data/models/BAAI__bge-small-en-v1.5"
if [ -f "$MODEL_DIR/config.json" ]; then
  echo "==> Embedding model already present at $MODEL_DIR"
else
  echo "==> Downloading BAAI/bge-small-en-v1.5 (~93 MB)"
  "$VENV_PY" "$AI/scripts/download_models.py"
fi

# 6. Verify imports.
echo "==> Verifying imports"
"$VENV_PY" -c "import fastapi, qdrant_client, groq, sentence_transformers, trafilatura, pymupdf, docx, tiktoken; print('    all imports OK')"

echo ""
echo "Install complete. Run: bash start.sh"
