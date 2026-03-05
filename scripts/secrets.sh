#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="$ROOT_DIR/.env.local"
SECRETS_YML="$ROOT_DIR/secrets.yml"

# Parse file list from secrets.yml (lines matching "  - <path>")
get_secret_files() {
  grep -E '^[[:space:]]*-[[:space:]]+' "$SECRETS_YML" | sed 's/^[[:space:]]*-[[:space:]]*//' | tr -d '\r'
}

# Load SECRETS_KEY from .env.local
load_key() {
  if [[ ! -f "$ENV_LOCAL" ]]; then
    echo "Error: $ENV_LOCAL not found. Run 'make set-new env' first." >&2
    exit 1
  fi

  SECRETS_KEY=$(grep '^SECRETS_KEY=' "$ENV_LOCAL" | head -1 | cut -d'=' -f2-)

  if [[ -z "$SECRETS_KEY" ]]; then
    echo "Error: SECRETS_KEY not set in $ENV_LOCAL. Run 'make set-new env' first." >&2
    exit 1
  fi
}

# Generate a new encryption key
cmd_keygen() {
  if [[ -f "$ENV_LOCAL" ]] && grep -q '^SECRETS_KEY=' "$ENV_LOCAL" 2>/dev/null; then
    echo "SECRETS_KEY already set in .env.local — skipping."
    return
  fi

  local key
  key=$(openssl rand -base64 32)

  if [[ -f "$ENV_LOCAL" ]]; then
    echo "SECRETS_KEY=$key" >> "$ENV_LOCAL"
  else
    echo "SECRETS_KEY=$key" > "$ENV_LOCAL"
  fi

  echo "Generated new SECRETS_KEY in .env.local"
  echo "Share this key with your team via a secure channel."
}

# Encrypt all secret files
cmd_encrypt() {
  load_key

  local errors=0
  while IFS= read -r file; do
    local src="$ROOT_DIR/$file"
    local dst="$ROOT_DIR/$file.enc"

    if [[ ! -f "$src" ]]; then
      echo "Warning: $file not found — skipping." >&2
      errors=$((errors + 1))
      continue
    fi

    openssl enc -aes-256-cbc -pbkdf2 -salt \
      -in "$src" -out "$dst" \
      -pass "pass:$SECRETS_KEY"

    echo "Encrypted: $file -> $file.enc"
  done < <(get_secret_files)

  if [[ $errors -gt 0 ]]; then
    echo ""
    echo "$errors file(s) skipped. Check warnings above."
  else
    echo ""
    echo "All secrets encrypted. Commit the .enc files."
  fi
}

# Decrypt all secret files
cmd_decrypt() {
  load_key

  local errors=0
  while IFS= read -r file; do
    local src="$ROOT_DIR/$file.enc"
    local dst="$ROOT_DIR/$file"

    if [[ ! -f "$src" ]]; then
      echo "Warning: $file.enc not found — skipping." >&2
      errors=$((errors + 1))
      continue
    fi

    if ! openssl enc -aes-256-cbc -pbkdf2 -d \
      -in "$src" -out "$dst" \
      -pass "pass:$SECRETS_KEY" 2>/dev/null; then
      echo "Error: Failed to decrypt $file.enc — wrong key?" >&2
      rm -f "$dst"
      errors=$((errors + 1))
      continue
    fi

    echo "Decrypted: $file.enc -> $file"
  done < <(get_secret_files)

  if [[ $errors -gt 0 ]]; then
    echo ""
    echo "$errors file(s) failed. Check warnings above."
    exit 1
  else
    echo ""
    echo "All secrets decrypted."
  fi
}

case "${1:-}" in
  keygen)  cmd_keygen ;;
  encrypt) cmd_encrypt ;;
  decrypt) cmd_decrypt ;;
  *)
    echo "Usage: $0 {keygen|encrypt|decrypt}" >&2
    exit 1
    ;;
esac
