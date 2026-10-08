#!/usr/bin/env bash
# QuarryFi Codex plugin setup
# Writes a privacy-preserving multi-profile config to ~/.quarryfi/config.json.

set -euo pipefail
umask 077

CONFIG_DIR="$HOME/.quarryfi"
CONFIG_FILE="$CONFIG_DIR/config.json"
DEFAULT_API_URL="https://quarryfi.com"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n\r\t' '   '
}

echo ""
echo "  QuarryFi Codex Tracker Setup"
echo "  ─────────────────────────────"
echo ""

if [ -f "$CONFIG_FILE" ]; then
  echo "  Existing config found at $CONFIG_FILE"
  echo "  The released plugin ignores legacy custom API URLs and always sends"
  echo "  tracker requests to ${DEFAULT_API_URL}."
  read -rp "  Replace the existing profiles? [y/N] " overwrite
  if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
    echo "  Setup cancelled without changing your config."
    exit 0
  fi
  echo ""
fi

PROFILES_JSON=""
profile_count=0

while true; do
  echo "  ── Profile $((profile_count + 1)) ──"
  echo ""

  read -rp "  Company/profile name: " profile_name
  if [ -z "$profile_name" ]; then
    echo "  ✗ Name is required."
    continue
  fi

  echo ""
  echo "  Get a seat-assigned tracker key from your QuarryFi Workspace dashboard:"
  echo "  ${DEFAULT_API_URL}/dashboard/team#tracking-plugins"
  echo "  Tracker keys and accepted heartbeats require QuarryFi Core."
  echo ""
  read -srp "  API Key (input hidden): " api_key
  echo ""

  if [[ ! "$api_key" =~ ^qf_[a-f0-9]{40}$ ]]; then
    echo "  ✗ Invalid key format. Expected qf_ plus 40 lowercase hex characters."
    echo "  This profile was not saved."
    continue
  fi

  echo ""
  echo "  Enter project directories for this company, one per line."
  echo "  Leave the first path blank to match all projects for this profile."
  echo ""
  projects_json="["
  project_count=0
  while true; do
    read -rp "  Project path: " project_path
    [ -z "$project_path" ] && break
    project_path="${project_path/#\~/$HOME}"
    if [ -d "$project_path" ]; then
      project_path=$(CDPATH= cd -- "$project_path" && pwd)
    fi
    [ "$project_count" -gt 0 ] && projects_json+=", "
    projects_json+="\"$(json_escape "$project_path")\""
    project_count=$((project_count + 1))
  done
  projects_json+="]"

  [ -n "$PROFILES_JSON" ] && PROFILES_JSON+=","
  PROFILES_JSON+="
    {
      \"name\": \"$(json_escape "$profile_name")\",
      \"api_key\": \"${api_key}\",
      \"api_url\": \"${DEFAULT_API_URL}\",
      \"projects\": ${projects_json}
    }"
  profile_count=$((profile_count + 1))

  echo ""
  echo "  ✓ Profile \"${profile_name}\" added."
  read -rp "  Add another profile? [y/N] " add_more
  if [[ ! "$add_more" =~ ^[Yy]$ ]]; then
    break
  fi
  echo ""
done

if [ "$profile_count" -eq 0 ]; then
  echo "  No profiles configured. Setup cancelled."
  exit 1
fi

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"
if [ -f "$CONFIG_FILE" ]; then
  cp "$CONFIG_FILE" "$CONFIG_FILE.bak"
  chmod 600 "$CONFIG_FILE.bak"
fi
config_tmp=$(mktemp "$CONFIG_DIR/config.XXXXXX")
trap 'rm -f "$config_tmp"' EXIT
cat > "$config_tmp" <<EOF
{
  "profiles": [${PROFILES_JSON}
  ]
}
EOF
chmod 600 "$config_tmp"
mv "$config_tmp" "$CONFIG_FILE"
trap - EXIT

echo ""
echo "  ✓ Config written to $CONFIG_FILE (${profile_count} profile(s))"
if [ -f "$CONFIG_FILE.bak" ]; then
  echo "  Previous config backed up to $CONFIG_FILE.bak"
fi
echo "  Verifying tracker keys against ${DEFAULT_API_URL}..."
echo ""

i=0
while [ "$i" -lt "$profile_count" ]; do
  profile_name=$(awk -v idx="$i" '/"name"/{if(n++==idx){gsub(/.*"name"[[:space:]]*:[[:space:]]*"/,""); gsub(/".*/,""); print; exit}}' "$CONFIG_FILE")
  api_key=$(awk -v idx="$i" '/"api_key"/{if(n++==idx){gsub(/.*"api_key"[[:space:]]*:[[:space:]]*"/,""); gsub(/".*/,""); print; exit}}' "$CONFIG_FILE")
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 \
    --proto '=https' \
    --tlsv1.2 \
    -X POST \
    -H "Authorization: Bearer ${api_key}" \
    -H "Content-Type: application/json" \
    -d '{"heartbeats":[{"source":"codex","project_name":"setup-verify","language":"multi","file_type":"multi","branch":"unknown","editor":"Codex","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","duration_seconds":0,"session_id":"setup-'"$$"'"}]}' \
    "${DEFAULT_API_URL}/api/heartbeat" 2>/dev/null || echo "000")

  case "$status" in
    200|201|204) echo "  ✓ ${profile_name}: key accepted" ;;
    401) echo "  ✗ ${profile_name}: key rejected; create or reassign the seat key in QuarryFi" ;;
    403) echo "  ✗ ${profile_name}: accepted heartbeats require active QuarryFi Core access" ;;
    *) echo "  ⚠ ${profile_name}: verification unavailable (HTTP ${status}); the key remains saved" ;;
  esac
  i=$((i + 1))
done

echo ""
echo "  Setup complete. Restart Codex, review the hook trust prompt, and start a"
echo "  new task. Then ask: Check my QuarryFi R&D tracking status."
echo ""
