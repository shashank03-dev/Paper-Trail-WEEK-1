#!/bin/sh
# Start Ollama, pull the model on first boot (persisted on the disk), keep serving.
set -e
MODEL="${OLLAMA_MODEL:-gemma4:e2b}"
ollama serve &
PID=$!
for i in $(seq 1 60); do
  ollama list >/dev/null 2>&1 && break
  sleep 1
done
if ! ollama list | grep -q "^${MODEL}"; then
  echo "Pulling ${MODEL} (first boot only)…"
  ollama pull "${MODEL}"
fi
# Warm it up so the first trail isn't the slow one.
ollama run "${MODEL}" "ready" >/dev/null 2>&1 || true
wait $PID
