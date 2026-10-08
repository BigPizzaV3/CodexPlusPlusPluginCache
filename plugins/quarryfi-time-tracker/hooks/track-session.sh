#!/usr/bin/env bash
# QuarryFi session tracker for OpenAI Codex
#
# Accuracy-first design:
# - Event hooks still flush immediately on real Codex activity
# - A background timer sends active-session heartbeats every 60s
# - All senders share one "last sent" clock to avoid double-counting
# - Failures are silenced so tracking never interrupts Codex

set -o pipefail
umask 077

CONFIG_DIR="$HOME/.quarryfi"
CONFIG_FILE="$CONFIG_DIR/config.json"
AUDIT_LOG="$CONFIG_DIR/audit.log"
AUDIT_MAX_BYTES=1048576
DEFAULT_API_URL="https://quarryfi.com"
HEARTBEAT_INTERVAL_SECONDS=60
MIN_TICK_DURATION_SECONDS=45
MAX_IDLE_SECONDS=300

CLI_EVENT="${1:-}"
CLI_CWD="${2:-}"
CLI_SESSION_ID="${3:-}"
EVENT_JSON=$(cat 2>/dev/null || true)
SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$SCRIPT_PATH")" 2>/dev/null && pwd)
PLUGIN_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." 2>/dev/null && pwd)
PLUGIN_MANIFEST="$PLUGIN_ROOT/.codex-plugin/plugin.json"
HOOK_MODE="event_plus_timer"

json_string() {
  printf '%s' "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/'
}

parse_event_fields() {
  if command -v node >/dev/null 2>&1; then
    printf '%s' "$EVENT_JSON" | node -e '
let input="";
process.stdin.setEncoding("utf8");
process.stdin.on("data",(chunk)=>input+=chunk);
process.stdin.on("end",()=>{
  try {
    const event=JSON.parse(input||"{}");
    const clean=(value)=>String(value??"").replace(/[\t\r\n]/g," ");
    process.stdout.write([
      clean(event.hook_event_name),
      clean(event.cwd),
      clean(event.session_id),
      clean(event.file_path??event.tool_input?.file_path),
    ].join("\t"));
  } catch {
    process.exitCode=1;
  }
});'
    return
  fi

  printf '%s\t%s\t%s\t%s' \
    "$(json_string "$EVENT_JSON" "hook_event_name")" \
    "$(json_string "$EVENT_JSON" "cwd")" \
    "$(json_string "$EVENT_JSON" "session_id")" \
    "$(json_string "$EVENT_JSON" "file_path")"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n\r\t' '   '
}

normalize_api_url() {
  # Released plugins always send to QuarryFi. The argument remains accepted so
  # older config files still parse, but it cannot redirect a seat credential.
  echo "$DEFAULT_API_URL"
}

IFS=$'\t' read -r EVENT_NAME_FROM_JSON EVENT_CWD_FROM_JSON EVENT_SESSION_ID_FROM_JSON EVENT_FILE_PATH_FROM_JSON <<< "$(parse_event_fields)"
EVENT_NAME_FROM_ENV="${CODEX_HOOK_EVENT:-${HOOK_EVENT_NAME:-}}"

get_plugin_version() {
  if [ -f "$PLUGIN_MANIFEST" ]; then
    grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$PLUGIN_MANIFEST" 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/'
    return
  fi
  echo "unknown"
}

get_runtime_channel() {
  case "$PLUGIN_ROOT" in
    *"/.codex/plugins/cache/openai-curated-remote/"*) echo "codex_public_directory_cache" ;;
    *"/.codex/plugins/cache/openai-curated/"*) echo "codex_public_directory_cache" ;;
    *"/.codex/plugins/cache/personal-plugins/"*) echo "codex_personal_cache" ;;
    *"/plugins/quarryfi-time-tracker"*) echo "codex_local_clone" ;;
    *) echo "codex_plugin_custom" ;;
  esac
}

get_install_revision() {
  if [ -f "$SCRIPT_PATH" ]; then
    shasum -a 256 "$SCRIPT_PATH" 2>/dev/null | cut -c1-12
    return
  fi
  if [ -f "$PLUGIN_MANIFEST" ]; then
    shasum -a 256 "$PLUGIN_MANIFEST" 2>/dev/null | cut -c1-12
    return
  fi
  echo "unknown"
}

get_cwd() {
  if [ -n "$CLI_CWD" ]; then
    echo "$CLI_CWD"
    return
  fi
  if [ -n "$EVENT_CWD_FROM_JSON" ]; then
    echo "$EVENT_CWD_FROM_JSON"
    return
  fi
  echo "${CODEX_PROJECT_DIR:-${CODEX_CWD:-$(pwd)}}"
}

resolve_effective_cwd() {
  local cwd="$1"

  [ ! -f "$CONFIG_FILE" ] && {
    echo "$cwd"
    return
  }

  if ! command -v node >/dev/null 2>&1; then
    echo "$cwd"
    return
  fi

  node - "$CONFIG_FILE" "$cwd" <<'NODE' 2>/dev/null || printf '%s\n' "$cwd"
const fs = require("fs");
const [file, cwdArg] = process.argv.slice(2);
const cwd = String(cwdArg || "");
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
const profiles = Array.isArray(cfg.profiles) ? cfg.profiles.filter(Boolean) : [cfg];
const keyedProfiles = profiles.filter((profile) => profile && profile.api_key);

function normalizedPath(value) {
  return String(value || "").replace(/\/+$/, "");
}

function projectPaths(profile) {
  return [
    ...(Array.isArray(profile.projects) ? profile.projects : []),
    ...(Array.isArray(profile.project_dirs) ? profile.project_dirs : []),
    ...(Array.isArray(profile.projectDirs) ? profile.projectDirs : []),
  ].filter(Boolean).map(normalizedPath);
}

function matchesProject(path, project) {
  const prefix = normalizedPath(project);
  const normalized = normalizedPath(path);
  return !prefix || normalized === prefix || normalized.startsWith(`${prefix}/`);
}

function codexDefault(profile) {
  return profile.codex_default_project ||
    profile.codexDefaultProject ||
    profile.codex_default_project_dir ||
    profile.codexDefaultProjectDir ||
    profile.codex_default_workspace ||
    profile.codexDefaultWorkspace ||
    "";
}

if (keyedProfiles.some((profile) => {
  const projects = projectPaths(profile);
  return projects.length === 0 || projects.some((project) => matchesProject(cwd, project));
})) {
  console.log(cwd);
  process.exit(0);
}

const defaults = keyedProfiles
  .map(codexDefault)
  .filter(Boolean);

if (defaults.length === 1) {
  console.log(defaults[0]);
  process.exit(0);
}

console.log(cwd);
NODE
}

session_dir() {
  local cwd="$1"
  local hash
  hash=$(printf '%s' "$cwd" | shasum -a 256 2>/dev/null | cut -c1-12)
  echo "$CONFIG_DIR/session-codex-${hash}"
}

session_file() {
  local cwd="$1"
  local name="$2"
  echo "$(session_dir "$cwd")/$name"
}

ensure_session_dir() {
  mkdir -p "$CONFIG_DIR" 2>/dev/null || true
  mkdir -p "$1" 2>/dev/null || true
}

get_session_id() {
  local cwd="$1"
  local sid_file
  sid_file=$(session_file "$cwd" "session_id")

  if [ -n "$CLI_SESSION_ID" ]; then
    printf '%s' "$CLI_SESSION_ID" > "$sid_file" 2>/dev/null || true
    echo "$CLI_SESSION_ID"
    return
  fi
  if [ -n "$EVENT_SESSION_ID_FROM_JSON" ]; then
    printf '%s' "$EVENT_SESSION_ID_FROM_JSON" > "$sid_file" 2>/dev/null || true
    echo "$EVENT_SESSION_ID_FROM_JSON"
    return
  fi
  if [ -n "${CODEX_SESSION_ID:-}" ]; then
    printf '%s' "$CODEX_SESSION_ID" > "$sid_file" 2>/dev/null || true
    echo "$CODEX_SESSION_ID"
    return
  fi
  if [ -f "$sid_file" ]; then
    cat "$sid_file" 2>/dev/null
    return
  fi

  local new_id
  new_id="codex-$(date +%s)-${RANDOM:-0}"
  printf '%s' "$new_id" > "$sid_file" 2>/dev/null || true
  echo "$new_id"
}

persist_session_context() {
  local cwd="$1"
  local session_id="$2"
  printf '%s' "$cwd" > "$(session_file "$cwd" "cwd")" 2>/dev/null || true
  printf '%s' "$session_id" > "$(session_file "$cwd" "session_id")" 2>/dev/null || true
}

timestamp_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

epoch_now() {
  date +%s 2>/dev/null || echo 0
}

clamp_duration() {
  local duration="$1"
  if [ "$duration" -lt 0 ] 2>/dev/null; then
    echo 0
  elif [ "$duration" -gt 86400 ] 2>/dev/null; then
    echo 86400
  else
    echo "$duration"
  fi
}

duration_since_last_sent() {
  local cwd="$1"
  local now_ts="$2"
  local last_file
  last_file=$(session_file "$cwd" "last_sent")
  if [ ! -f "$last_file" ]; then
    echo 0
    return
  fi

  local last_ts
  last_ts=$(cat "$last_file" 2>/dev/null)
  if [ -z "$last_ts" ]; then
    echo 0
    return
  fi

  clamp_duration $(( now_ts - last_ts ))
}

record_last_sent() {
  local cwd="$1"
  local now_ts="$2"
  printf '%s' "$now_ts" > "$(session_file "$cwd" "last_sent")" 2>/dev/null || true
}

record_last_activity() {
  local cwd="$1"
  local now_ts="$2"
  printf '%s' "$now_ts" > "$(session_file "$cwd" "last_activity")" 2>/dev/null || true
}

activity_is_fresh() {
  local cwd="$1"
  local now_ts="$2"
  local activity_file last_activity age
  activity_file=$(session_file "$cwd" "last_activity")
  [ -f "$activity_file" ] || return 1
  last_activity=$(cat "$activity_file" 2>/dev/null)
  [ -n "$last_activity" ] || return 1
  age=$(( now_ts - last_activity ))
  [ "$age" -lt 0 ] 2>/dev/null && return 0
  [ "$age" -le "$MAX_IDLE_SECONDS" ] 2>/dev/null
}

cleanup_session_state() {
  local cwd="$1"
  rm -f \
    "$(session_file "$cwd" "last_sent")" \
    "$(session_file "$cwd" "last_activity")" \
    "$(session_file "$cwd" "session_id")" \
    "$(session_file "$cwd" "cwd")" \
    "$(session_file "$cwd" "timer.pid")" 2>/dev/null || true
  rmdir "$(session_dir "$cwd")" 2>/dev/null || true
}

rotate_audit_log() {
  if [ -f "$AUDIT_LOG" ]; then
    local size
    size=$(wc -c < "$AUDIT_LOG" 2>/dev/null || echo 0)
    if [ "$size" -gt "$AUDIT_MAX_BYTES" ]; then
      local lines keep
      lines=$(wc -l < "$AUDIT_LOG" 2>/dev/null || echo 0)
      keep=$(( lines / 2 ))
      tail -n "$keep" "$AUDIT_LOG" > "$AUDIT_LOG.tmp" 2>/dev/null && \
        mv -f "$AUDIT_LOG.tmp" "$AUDIT_LOG" 2>/dev/null || \
        rm -f "$AUDIT_LOG.tmp"
    fi
  fi
}

append_audit() {
  local profile_name="$1"
  local payload="$2"
  local api_url="$3"
  local http_status="$4"

  local safe_profile safe_api_url safe_status
  safe_profile=$(json_escape "$profile_name")
  safe_api_url=$(json_escape "$api_url")
  safe_status=$(json_escape "$http_status")
  rotate_audit_log
  printf '{"ts":"%s","profile":"%s","api_url":"%s","http_status":"%s","payload":%s}\n' \
    "$(timestamp_utc)" "$safe_profile" "$safe_api_url" "$safe_status" "$payload" >> "$AUDIT_LOG" 2>/dev/null || true
}

append_status_audit() {
  local project_name="$1"
  local event_name="$2"
  local status="$3"

  local safe_project safe_event safe_status
  safe_project=$(json_escape "$project_name")
  safe_event=$(json_escape "$event_name")
  safe_status=$(json_escape "$status")
  rotate_audit_log
  printf '{"ts":"%s","project":"%s","event":"%s","status":"%s"}\n' \
    "$(timestamp_utc)" "$safe_project" "$safe_event" "$safe_status" >> "$AUDIT_LOG" 2>/dev/null || true
}

get_project_name() {
  local cwd="$1"
  local name
  name=$(basename "$cwd")
  if [ -z "$name" ] || [ "$name" = "/" ]; then
    name=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null | xargs basename 2>/dev/null)
  fi
  echo "${name:-unknown}"
}

get_editor() {
  case "${CODEX_CLIENT:-cli}" in
    app|desktop) echo "Codex App" ;;
    *) echo "Codex CLI" ;;
  esac
}

get_branch() {
  local cwd="$1"
  git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

get_head_sha() {
  git -C "$1" rev-parse HEAD 2>/dev/null | grep -E '^[a-fA-F0-9]{7,64}$' || true
}

get_repo_fingerprint() {
  local cwd="$1" remote canonical
  remote=$(git -C "$cwd" config --get remote.origin.url 2>/dev/null || true)
  case "$remote" in
    *github.com:*) canonical=${remote#*github.com:} ;;
    *github.com/*) canonical=${remote#*github.com/} ;;
    *) return ;;
  esac
  canonical=$(printf '%s' "$canonical" | sed 's/\.git$//' | tr '[:upper:]' '[:lower:]')
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$canonical" | shasum -a 256 | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$canonical" | sha256sum | awk '{print $1}'
  fi
}

get_changed_file_count() {
  local count
  count=$(git -C "$1" status --porcelain --untracked-files=no 2>/dev/null | wc -l | tr -d ' ')
  case "$count" in ''|*[!0-9]*) echo 0 ;; *) [ "$count" -gt 10000 ] && echo 10000 || echo "$count" ;; esac
}

get_activity_kind() {
  local value
  value=$(printf '%s' "$EVENT_FILE_PATH_FROM_JSON" | tr '[:upper:]' '[:lower:]')
  case "$value" in
    *'/test/'*|*'/tests/'*|*'__tests__'*|*'.test.'*|*'.spec.'*) echo "test" ;;
    *migration*|*schema*|*.sql) echo "schema" ;;
    *.md|*.markdown|*.rst) echo "documentation" ;;
    *.json|*.yaml|*.yml|*.toml|*.ini|*.env) echo "configuration" ;;
    *) echo "implementation" ;;
  esac
}

get_language() {
  local dir="$1"

  if [ -n "$EVENT_FILE_PATH_FROM_JSON" ]; then
    local ext
    ext="${EVENT_FILE_PATH_FROM_JSON##*.}"
    if [ -n "$ext" ] && [ "$ext" != "$EVENT_FILE_PATH_FROM_JSON" ]; then
      case "$ext" in
        ts|tsx) echo "typescript"; return ;;
        js|jsx) echo "javascript"; return ;;
        py) echo "python"; return ;;
        rs) echo "rust"; return ;;
        go) echo "go"; return ;;
        rb) echo "ruby"; return ;;
        java|kt) echo "java"; return ;;
        php) echo "php"; return ;;
        swift) echo "swift"; return ;;
        c|cpp|h) echo "c/cpp"; return ;;
        sh|bash|zsh) echo "shell"; return ;;
        json) echo "json"; return ;;
        md|markdown) echo "markdown"; return ;;
      esac
    fi
  fi

  if [ -f "$dir/package.json" ] || [ -f "$dir/tsconfig.json" ]; then
    if [ -f "$dir/tsconfig.json" ]; then echo "typescript"; return; fi
    echo "javascript"; return
  fi
  if [ -f "$dir/Cargo.toml" ]; then echo "rust"; return; fi
  if [ -f "$dir/go.mod" ]; then echo "go"; return; fi
  if [ -f "$dir/pyproject.toml" ] || [ -f "$dir/setup.py" ] || [ -f "$dir/setup.cfg" ]; then echo "python"; return; fi
  if [ -f "$dir/Gemfile" ]; then echo "ruby"; return; fi
  if [ -f "$dir/build.gradle" ] || [ -f "$dir/pom.xml" ]; then echo "java"; return; fi
  if [ -f "$dir/mix.exs" ]; then echo "elixir"; return; fi
  if [ -f "$dir/composer.json" ]; then echo "php"; return; fi
  if [ -f "$dir/Package.swift" ]; then echo "swift"; return; fi
  if [ -f "$dir/CMakeLists.txt" ] || [ -f "$dir/Makefile" ]; then echo "c/cpp"; return; fi

  echo "multi"
}

get_file_type() {
  local dir="$1"

  if [ -n "$EVENT_FILE_PATH_FROM_JSON" ]; then
    local event_ext
    event_ext="${EVENT_FILE_PATH_FROM_JSON##*.}"
    if [ -n "$event_ext" ] && [ "$event_ext" != "$EVENT_FILE_PATH_FROM_JSON" ]; then
      echo "$event_ext"
      return
    fi
  fi

  local recent_ext
  recent_ext=$(git -C "$dir" diff --name-only HEAD~3 HEAD 2>/dev/null | grep '\.' | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}')
  if [ -n "$recent_ext" ]; then
    local ext_count
    ext_count=$(git -C "$dir" diff --name-only HEAD~3 HEAD 2>/dev/null | grep '\.' | sed 's/.*\.//' | sort -u | wc -l | tr -d ' ')
    if [ "$ext_count" -gt 3 ]; then
      echo "multi"
    else
      echo "$recent_ext"
    fi
    return
  fi

  case "$(get_language "$dir")" in
    typescript) echo "ts" ;;
    javascript) echo "js" ;;
    python) echo "py" ;;
    rust) echo "rs" ;;
    go) echo "go" ;;
    ruby) echo "rb" ;;
    java) echo "java" ;;
    php) echo "php" ;;
    swift) echo "swift" ;;
    c/cpp) echo "cpp" ;;
    shell) echo "sh" ;;
    *) echo "multi" ;;
  esac
}

map_event() {
  case "$1" in
    SessionStart) echo "session_start" ;;
    Stop) echo "session_end" ;;
    *) echo "heartbeat" ;;
  esac
}

build_payload() {
  local event="$1"
  local duration="$2"
  local now="$3"
  local session_id="$4"
  local project_name="$5"
  local editor="$6"
  local branch="$7"
  local language="$8"
  local file_type="$9"
  local plugin_version="${10}"
  local runtime_channel="${11}"
  local install_revision="${12}"
  local host_app="${13}"
  local head_sha="${14}"
  local repo_fingerprint="${15}"
  local activity_kind="${16}"
  local changed_file_count="${17}"
  local safe_event safe_now safe_session_id safe_project_name safe_editor safe_branch safe_language safe_file_type
  local safe_plugin_version safe_runtime_channel safe_install_revision safe_host_app safe_head_sha safe_repo_fingerprint safe_activity_kind
  safe_event=$(json_escape "$event")
  safe_now=$(json_escape "$now")
  safe_session_id=$(json_escape "$session_id")
  safe_project_name=$(json_escape "$project_name")
  safe_editor=$(json_escape "$editor")
  safe_branch=$(json_escape "$branch")
  safe_language=$(json_escape "$language")
  safe_file_type=$(json_escape "$file_type")
  safe_plugin_version=$(json_escape "$plugin_version")
  safe_runtime_channel=$(json_escape "$runtime_channel")
  safe_install_revision=$(json_escape "$install_revision")
  safe_host_app=$(json_escape "$host_app")
  safe_head_sha=$(json_escape "$head_sha")
  safe_repo_fingerprint=$(json_escape "$repo_fingerprint")
  safe_activity_kind=$(json_escape "$activity_kind")

  local head_fragment="" repo_fragment=""
  [ -n "$safe_head_sha" ] && head_fragment=",\"head_sha\":\"${safe_head_sha}\""
  [ -n "$safe_repo_fingerprint" ] && repo_fragment=",\"repo_fingerprint\":\"${safe_repo_fingerprint}\""

  cat <<EOF
{"client":{"plugin_version":"${safe_plugin_version}","runtime_channel":"${safe_runtime_channel}","hook_mode":"${HOOK_MODE}","install_revision":"${safe_install_revision}","host_app":"${safe_host_app}"},"heartbeats":[{"source":"codex","project_name":"${safe_project_name}","language":"${safe_language}","file_type":"${safe_file_type}","branch":"${safe_branch}","editor":"${safe_editor}","timestamp":"${safe_now}","duration_seconds":${duration},"session_id":"${safe_session_id}","event":"${safe_event}"${head_fragment}${repo_fragment},"activity_kind":"${safe_activity_kind}","changed_file_count":${changed_file_count}}]}
EOF
}

maybe_emit_update_notice() {
  local response_file="$1"
  local source="$2"
  [ ! -s "$response_file" ] && return
  grep -Eq '"updateAvailable"[[:space:]]*:[[:space:]]*true' "$response_file" 2>/dev/null || return

  local latest_version update_url safe_version notice_dir notice_file
  latest_version=$(grep -o '"latestVersion"[[:space:]]*:[[:space:]]*"[^"]*"' "$response_file" 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*"\([^"]*\)"/\1/')
  update_url=$(grep -o '"updateUrl"[[:space:]]*:[[:space:]]*"[^"]*"' "$response_file" 2>/dev/null | head -1 | sed 's/.*:[[:space:]]*"\([^"]*\)"/\1/')
  safe_version=$(printf '%s' "$latest_version" | tr -cd '0-9A-Za-z._-')
  [ -z "$safe_version" ] && return

  notice_dir="$CONFIG_DIR/update-notices"
  notice_file="$notice_dir/${source}-${safe_version}"
  mkdir -p "$notice_dir" 2>/dev/null || return
  find "$notice_dir" -type f -mtime +30 -delete 2>/dev/null || true
  [ -f "$notice_file" ] && return
  : > "$notice_file"
  printf '[QuarryFi] Tracker update v%s available: %s\n' "$latest_version" "$update_url" >&2
}

send_heartbeat_to_profile() {
  local api_key="$1"
  local api_url="$2"
  local profile_name="$3"
  local payload="$4"
  local project_name="$5"
  local event_name="$6"

  api_url=$(normalize_api_url "$api_url")
  local http_status response_file
  response_file=$(mktemp "${TMPDIR:-/tmp}/quarryfi-heartbeat.XXXXXX" 2>/dev/null || true)
  [ -z "$response_file" ] && response_file="/dev/null"
  http_status=$(curl -s -o "$response_file" -w "%{http_code}" \
    --max-time 5 \
    --proto '=https' \
    --tlsv1.2 \
    -X POST \
    -H "Authorization: Bearer ${api_key}" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "${api_url}/api/heartbeat" 2>/dev/null || echo "000")

  append_audit "$profile_name" "$payload" "$api_url" "$http_status"
  if [ "$http_status" = "200" ] || [ "$http_status" = "201" ] || [ "$http_status" = "204" ]; then
    maybe_emit_update_notice "$response_file" "codex"
    append_status_audit "$project_name" "$event_name" "sent"
  else
    append_status_audit "$project_name" "$event_name" "error:${http_status}"
  fi
  [ "$response_file" != "/dev/null" ] && rm -f "$response_file"
}

is_legacy_config() {
  grep -q '"profiles"' "$CONFIG_FILE" 2>/dev/null && return 1
  grep -q '"api_key"' "$CONFIG_FILE" 2>/dev/null && return 0
  return 1
}

dispatch_to_profiles() {
  local cwd="$1"
  local session_id="$2"
  local event="$3"
  local duration="$4"

  [ ! -f "$CONFIG_FILE" ] && return

  local now project_name editor branch language file_type payload
  local plugin_version runtime_channel install_revision host_app head_sha repo_fingerprint activity_kind changed_file_count
  now=$(timestamp_utc)
  project_name=$(get_project_name "$cwd")
  editor=$(get_editor)
  branch=$(get_branch "$cwd")
  language=$(get_language "$cwd")
  file_type=$(get_file_type "$cwd")
  plugin_version=$(get_plugin_version)
  runtime_channel=$(get_runtime_channel)
  install_revision=$(get_install_revision)
  host_app=$(printf '%s' "$editor" | tr '[:upper:] ' '[:lower:]_' | tr -s '_')
  head_sha=$(get_head_sha "$cwd")
  repo_fingerprint=$(get_repo_fingerprint "$cwd")
  activity_kind=$(get_activity_kind)
  changed_file_count=$(get_changed_file_count "$cwd")
  append_status_audit "$project_name" "$event" "hook_fired"
  payload=$(build_payload "$event" "$duration" "$now" "$session_id" "$project_name" "$editor" "$branch" "$language" "$file_type" "$plugin_version" "$runtime_channel" "$install_revision" "$host_app" "$head_sha" "$repo_fingerprint" "$activity_kind" "$changed_file_count")

  if is_legacy_config; then
    local config_content api_key api_url
    config_content=$(cat "$CONFIG_FILE" 2>/dev/null)
    api_key=$(json_string "$config_content" "api_key")
    api_url=$(json_string "$config_content" "api_url")
    api_url="${api_url:-$DEFAULT_API_URL}"
    if [ -n "$api_key" ]; then
      send_heartbeat_to_profile "$api_key" "$api_url" "default" "$payload" "$project_name" "$event"
    else
      append_status_audit "$project_name" "$event" "skipped:missing_credentials"
    fi
    return
  fi

  if command -v node >/dev/null 2>&1; then
    local matched_profiles
    matched_profiles=$(node - "$CONFIG_FILE" "$cwd" <<'NODE' 2>/dev/null
const fs = require("fs");
const [file, cwd] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
const profiles = Array.isArray(cfg.profiles) ? cfg.profiles : [cfg];
const normalizedCwd = String(cwd || "");

function matchesProject(project) {
  const prefix = String(project || "").replace(/\/+$/, "");
  return !prefix || normalizedCwd === prefix || normalizedCwd.startsWith(`${prefix}/`);
}

function projectPaths(profile) {
  return [
    ...(Array.isArray(profile.projects) ? profile.projects : []),
    ...(Array.isArray(profile.project_dirs) ? profile.project_dirs : []),
    ...(Array.isArray(profile.projectDirs) ? profile.projectDirs : []),
  ].filter(Boolean);
}

for (const profile of profiles) {
  if (!profile || !profile.api_key) continue;
  const projects = projectPaths(profile);
  if (projects.length > 0 && !projects.some(matchesProject)) continue;
  console.log([
    profile.name || "unnamed",
    profile.api_key,
    profile.api_url || "https://quarryfi.com",
  ].join("\t"));
}
NODE
)

    local sent=0
    local send_pids=""
    while IFS=$'\t' read -r profile_name api_key api_url; do
      [ -z "$api_key" ] && continue
      send_heartbeat_to_profile "$api_key" "$api_url" "$profile_name" "$payload" "$project_name" "$event" &
      send_pids="${send_pids} $!"
      sent=$((sent + 1))
    done <<< "$matched_profiles"

    if [ "$sent" -gt 0 ]; then
      local pid
      for pid in $send_pids; do
        wait "$pid" 2>/dev/null || true
      done
    elif command -v node >/dev/null 2>&1; then
      local fallback_profile
      fallback_profile=$(node - "$CONFIG_FILE" <<'NODE' 2>/dev/null
const fs = require("fs");
const [file] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
const profiles = (Array.isArray(cfg.profiles) ? cfg.profiles : [cfg])
  .filter((profile) => profile && profile.api_key);

if (profiles.length !== 1) process.exit(0);

const profile = profiles[0];
console.log([
  profile.name || "unnamed",
  profile.api_key,
  profile.api_url || "https://quarryfi.com",
].join("\t"));
NODE
)
      if [ -n "$fallback_profile" ]; then
        while IFS=$'\t' read -r profile_name api_key api_url; do
          [ -z "$api_key" ] && continue
          send_heartbeat_to_profile "$api_key" "$api_url" "$profile_name" "$payload" "$project_name" "$event" &
          send_pids="${send_pids} $!"
          sent=$((sent + 1))
        done <<< "$fallback_profile"
        for pid in $send_pids; do
          wait "$pid" 2>/dev/null || true
        done
      else
        append_status_audit "$project_name" "$event" "skipped:no_matching_profile"
      fi
    else
      append_status_audit "$project_name" "$event" "skipped:no_matching_profile"
    fi
  fi
}

timer_is_running() {
  local cwd="$1"
  local pid_file timer_state timer_pid timer_revision current_revision
  pid_file=$(session_file "$cwd" "timer.pid")
  [ -f "$pid_file" ] || return 1
  timer_state=$(cat "$pid_file" 2>/dev/null)
  case "$timer_state" in
    *"|"*) ;;
    *)
      rm -f "$pid_file" 2>/dev/null || true
      return 1
      ;;
  esac
  timer_pid=${timer_state%%|*}
  timer_revision=${timer_state#*|}
  [ -n "$timer_pid" ] || return 1
  current_revision=$(get_install_revision)
  if [ -z "$timer_revision" ] || [ "$timer_revision" != "$current_revision" ]; then
    rm -f "$pid_file" 2>/dev/null || true
    return 1
  fi
  kill -0 "$timer_pid" 2>/dev/null
}

start_timer_loop() {
  local cwd="$1"
  local session_id="$2"
  local pid_file install_revision
  pid_file=$(session_file "$cwd" "timer.pid")

  if timer_is_running "$cwd"; then
    return
  fi

  install_revision=$(get_install_revision)
  nohup "$0" "__timer_loop" "$cwd" "$session_id" >/dev/null 2>&1 &
  printf '%s|%s' "$!" "$install_revision" > "$pid_file" 2>/dev/null || true
}

stop_timer_loop() {
  local cwd="$1"
  local pid_file timer_state timer_pid
  pid_file=$(session_file "$cwd" "timer.pid")
  if [ -f "$pid_file" ]; then
    timer_state=$(cat "$pid_file" 2>/dev/null)
    timer_pid=${timer_state%%|*}
    if [ -n "$timer_pid" ]; then
      kill "$timer_pid" 2>/dev/null || true
    fi
    rm -f "$pid_file" 2>/dev/null || true
  fi
}

cleanup_timer_pid() {
  local cwd="$1"
  local pid_file timer_identity
  pid_file=$(session_file "$cwd" "timer.pid")
  timer_identity="$$|$(get_install_revision)"
  if [ "$(cat "$pid_file" 2>/dev/null)" = "$timer_identity" ]; then
    rm -f "$pid_file" 2>/dev/null || true
  fi
}

run_timer_loop() {
  local cwd="$1"
  local session_id="$2"
  local pid_file timer_identity
  pid_file=$(session_file "$cwd" "timer.pid")
  timer_identity="$$|$(get_install_revision)"
  printf '%s' "$timer_identity" > "$pid_file" 2>/dev/null || true
  trap 'cleanup_timer_pid "$cwd"' EXIT
  trap 'cleanup_timer_pid "$cwd"; exit 0' HUP INT TERM

  while true; do
    if [ ! -f "$(session_file "$cwd" "session_id")" ]; then
      exit 0
    fi
    if [ "$(cat "$pid_file" 2>/dev/null)" != "$timer_identity" ]; then
      exit 0
    fi

    local now_ts duration_seconds
    now_ts=$(epoch_now)
    if ! activity_is_fresh "$cwd" "$now_ts"; then
      append_status_audit "$(basename "$cwd")" "heartbeat" "timer_expired:idle"
      exit 0
    fi

    sleep "$HEARTBEAT_INTERVAL_SECONDS" || exit 0

    if [ ! -f "$(session_file "$cwd" "session_id")" ]; then
      exit 0
    fi
    if [ "$(cat "$pid_file" 2>/dev/null)" != "$timer_identity" ]; then
      exit 0
    fi

    now_ts=$(epoch_now)
    if ! activity_is_fresh "$cwd" "$now_ts"; then
      append_status_audit "$(basename "$cwd")" "heartbeat" "timer_expired:idle"
      exit 0
    fi
    duration_seconds=$(duration_since_last_sent "$cwd" "$now_ts")
    if [ "$duration_seconds" -lt "$MIN_TICK_DURATION_SECONDS" ] 2>/dev/null; then
      continue
    fi

    dispatch_to_profiles "$cwd" "$session_id" "heartbeat" "$duration_seconds"
    record_last_sent "$cwd" "$now_ts"
  done
}

main() {
  local cwd session_id raw_event event_type now_ts duration_seconds
  cwd=$(get_cwd)
  cwd=$(resolve_effective_cwd "$cwd")
  [ -z "$cwd" ] && exit 0
  ensure_session_dir "$(session_dir "$cwd")"

  if [ "$CLI_EVENT" = "__timer_loop" ]; then
    run_timer_loop "$cwd" "$(get_session_id "$cwd")"
    exit 0
  fi

  session_id=$(get_session_id "$cwd")
  persist_session_context "$cwd" "$session_id"

  raw_event="${CLI_EVENT:-${EVENT_NAME_FROM_JSON:-$EVENT_NAME_FROM_ENV}}"
  [ -z "$raw_event" ] && raw_event="heartbeat"
  event_type=$(map_event "$raw_event")

  if { [ "$event_type" = "session_end" ] && [ ! -f "$(session_file "$cwd" "last_sent")" ] && [ ! -f "$(session_file "$cwd" "timer.pid")" ]; }; then
    exit 0
  fi

  now_ts=$(epoch_now)
  record_last_activity "$cwd" "$now_ts"
  if [ "$raw_event" = "SessionStart" ]; then
    dispatch_to_profiles "$cwd" "$session_id" "session_start" 0
    record_last_sent "$cwd" "$now_ts"
    start_timer_loop "$cwd" "$session_id"
    exit 0
  fi

  if ! timer_is_running "$cwd"; then
    start_timer_loop "$cwd" "$session_id"
  fi

  duration_seconds=$(duration_since_last_sent "$cwd" "$now_ts")
  dispatch_to_profiles "$cwd" "$session_id" "$event_type" "$duration_seconds"
  record_last_sent "$cwd" "$now_ts"

  if [ "$event_type" = "session_end" ]; then
    stop_timer_loop "$cwd"
    cleanup_session_state "$cwd"
  fi
}

main
exit 0
