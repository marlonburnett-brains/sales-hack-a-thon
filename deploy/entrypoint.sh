#!/bin/sh
# Container entrypoint for the Mastra agent server
#
# Writes Vertex AI credentials from env var to a temp file.
# The @google/genai SDK reads GOOGLE_APPLICATION_CREDENTIALS automatically,
# but it only supports file paths (not inline JSON). This script bridges
# the gap by writing the JSON content to a file at startup.

echo "[entrypoint] Starting..."
echo "[entrypoint] Node version: $(node --version 2>&1 || echo 'node not found')"
echo "[entrypoint] Working dir: $(pwd)"
echo "[entrypoint] Files: $(ls -la 2>&1 | head -5)"

if [ -n "$VERTEX_SERVICE_ACCOUNT_KEY" ]; then
  echo "[entrypoint] Writing Vertex AI credentials..."
  echo "$VERTEX_SERVICE_ACCOUNT_KEY" > /tmp/vertex-credentials.json
  export GOOGLE_APPLICATION_CREDENTIALS=/tmp/vertex-credentials.json
  echo "[entrypoint] Credentials written to /tmp/vertex-credentials.json"
fi

echo "[entrypoint] Launching: $@"
exec "$@"
