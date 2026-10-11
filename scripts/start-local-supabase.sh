#!/bin/bash
# One Mac entry point. Docker Desktop must already be running.
set +x
set -euo pipefail
umask 077
export HOMEBREW_NO_ANALYTICS=1
export PATH="/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[[ "$(uname -s)" == Darwin ]] || { echo 'Dit startscript is uitsluitend voor macOS.'; exit 1; }
ROOT="$HOME/Library/Application Support/JK Works Restore Test"
HERE="$(cd "$(dirname "$0")" && pwd)"
case "${1:-}" in
  '') MODE=fixture ;;
  --stop) MODE=stop ;;
  --remove) MODE=remove ;;
  --download) MODE=download ;;
  *) echo 'Gebruik: start-local-supabase.sh [--stop|--remove|--download]'; exit 1 ;;
esac
unset DOCKER_HOST DOCKER_TLS_VERIFY DOCKER_CERT_PATH SUPABASE_ACCESS_TOKEN
if [[ "$MODE" == fixture ]]; then
  docker --context desktop-linux info > /dev/null 2>&1 || { echo 'Start Docker Desktop en voer dit script opnieuw uit.'; exit 1; }
  mkdir -p "$ROOT/tools" "$ROOT/project/supabase" "$ROOT/tmp" "$ROOT/logs"
  chmod 700 "$ROOT"
  if [[ ! -f "$ROOT/installed-v1" || ! -x "$ROOT/tools/supabase" || ! -x "$ROOT/venv/bin/python" ]]; then
    if ! command -v brew >/dev/null; then
      echo 'Homebrew ontbreekt. De officiële installer kan om je Mac-wachtwoord en Command Line Tools vragen.'
      curl --fail --silent --show-error --location https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh --output "$ROOT/tmp/homebrew-install.sh"
      /bin/bash "$ROOT/tmp/homebrew-install.sh"
      rm "$ROOT/tmp/homebrew-install.sh"
    fi
    command -v brew >/dev/null || { echo 'Homebrew-installatie niet voltooid; stop zonder lokale gegevens te wijzigen.'; exit 1; }
    echo 'Installeert gratis lokale hulpmiddelen; geen Supabase-login of cloudproject nodig.'
    brew install rclone python@3.12
    case "$(uname -m)" in arm64) ARCH=arm64 ;; x86_64) ARCH=amd64 ;; *) echo 'Deze Mac-architectuur wordt niet ondersteund.'; exit 1 ;; esac
    VERSION=2.120.0
    ASSET="supabase_${VERSION}_darwin_${ARCH}.tar.gz"
    curl --fail --silent --show-error --location "https://github.com/supabase/cli/releases/download/v${VERSION}/${ASSET}" --output "$ROOT/tmp/cli.tar.gz"
    curl --fail --silent --show-error --location "https://github.com/supabase/cli/releases/download/v${VERSION}/checksums.txt" --output "$ROOT/tmp/checksums.txt"
    PYTHON="$(brew --prefix python@3.12)/bin/python3.12"
    "$PYTHON" - "$ROOT" "$ASSET" <<'PY'
import hashlib, sys, tarfile
from pathlib import Path
root, name = Path(sys.argv[1]), sys.argv[2]
rows = [line.split() for line in (root/'tmp/checksums.txt').read_text().splitlines()]
expected = next(row[0] for row in rows if row[-1].lstrip('*') == name)
assert hashlib.sha256((root/'tmp/cli.tar.gz').read_bytes()).hexdigest() == expected, 'CLI checksum mismatch'
with tarfile.open(root/'tmp/cli.tar.gz') as archive:
    archive.extract('supabase', root/'tools', filter='data')
PY
    "$PYTHON" -m venv "$ROOT/venv"
    "$ROOT/venv/bin/python" -m pip install --disable-pip-version-check 'psycopg[binary]==3.2.13' > "$ROOT/logs/install-python.log" 2>&1
    cat > "$ROOT/project/supabase/config.toml" <<'TOML'
project_id = "jkworks-local-restore-test"
[api]
enabled = true
port = 56321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
[db]
port = 56322
shadow_port = 56320
major_version = 17
[db.seed]
enabled = false
[realtime]
enabled = false
[studio]
enabled = false
[local_smtp]
enabled = true
port = 56324
[storage]
enabled = true
file_size_limit = "50MiB"
[auth]
enabled = true
site_url = "http://127.0.0.1:56321"
additional_redirect_urls = []
enable_signup = true
[auth.email]
enable_signup = true
enable_confirmations = false
[edge_runtime]
enabled = false
[analytics]
enabled = false
TOML
    rm "$ROOT/tmp/cli.tar.gz" "$ROOT/tmp/checksums.txt"
    touch "$ROOT/installed-v1"
  fi
fi
[[ -x "$ROOT/tools/supabase" && -x "$ROOT/venv/bin/python" ]] || { echo 'Start eerst eenmaal zonder opties om de lokale hulpmiddelen te installeren.'; exit 1; }
"$ROOT/venv/bin/python" "$HERE/local_supabase_test.py" "$MODE" "$ROOT"
