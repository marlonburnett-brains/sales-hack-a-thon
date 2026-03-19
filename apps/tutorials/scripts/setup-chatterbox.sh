#!/usr/bin/env bash
# scripts/setup-chatterbox.sh -- One-time Chatterbox-Turbo Python venv + model setup
set -euo pipefail

VENV_DIR="$(cd "$(dirname "$0")/.." && pwd)/.venv"

# Check Python 3.11 is available
if ! command -v python3.11 &>/dev/null; then
  echo "Error: Python 3.11 required. Install with: brew install python@3.11"
  exit 1
fi

echo "Setting up Chatterbox-Turbo venv at $VENV_DIR..."

python3.11 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

pip install --upgrade pip
pip install torch torchaudio
pip install chatterbox-tts

echo ""
echo "Chatterbox-Turbo setup complete. Model will download (~2GB) on first use."
