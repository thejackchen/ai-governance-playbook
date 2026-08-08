#!/bin/bash

set -euo pipefail
IFS=$'\n\t'

usage() {
  cat <<'EOF' >&2
Usage: prepare-source-packet.sh --repo <absolute-or-relative-repo> --output <zip-path> [--include <repo-relative-path>]...
EOF
  exit 2
}

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

publish_fail() {
  local message
  message=$1

  if [ "${ZIP_PUBLISHED:-false}" = true ]; then
    if [ -n "${OUTPUT_BACKUP:-}" ] && [ -e "$OUTPUT_BACKUP" ]; then
      mv -f "$OUTPUT_BACKUP" "$OUTPUT_ABS" >/dev/null 2>&1 || true
    else
      rm -f "$OUTPUT_ABS" >/dev/null 2>&1 || true
    fi
  fi

  if [ "${MANIFEST_PUBLISHED:-false}" = true ]; then
    if [ -n "${MANIFEST_BACKUP:-}" ] && [ -e "$MANIFEST_BACKUP" ]; then
      mv -f "$MANIFEST_BACKUP" "$MANIFEST_ABS" >/dev/null 2>&1 || true
    else
      rm -f "$MANIFEST_ABS" >/dev/null 2>&1 || true
    fi
  fi

  die "$message"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

trim_trailing_slashes() {
  local value
  value=$1
  while [ "$value" != "/" ] && [ "${value%/}" != "$value" ]; do
    value=${value%/}
  done
  printf '%s\n' "$value"
}

normalize_include() {
  local value
  value=$1
  while [ "${value#./}" != "$value" ]; do
    value=${value#./}
  done
  value=$(trim_trailing_slashes "$value")
  case "$value" in
    ""|".")
      printf '.\n'
      return 0
      ;;
    /*)
      return 1
      ;;
    ..|../*|*/../*|*/..)
      return 1
      ;;
  esac
  printf '%s\n' "$value"
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

safe_candidate_path() {
  local rel
  rel=$1
  case "$rel" in
    ""|/*|../*|*/../*|*/..|..)
      return 1
      ;;
  esac
  return 0
}

matches_include() {
  local rel include
  rel=$1
  if [ "${#INCLUDES[@]}" -eq 0 ]; then
    return 0
  fi
  for include in "${INCLUDES[@]}"; do
    case "$include" in
      ".")
        return 0
        ;;
      *)
        case "$rel" in
          "$include"|"$include"/*)
            return 0
            ;;
        esac
        ;;
    esac
  done
  return 1
}

is_env_allowlisted() {
  case "$1" in
    .env.example|.env.sample|.env.template)
      return 0
      ;;
  esac
  return 1
}

is_disallowed_path() {
  local rel base lower_base
  rel=$1
  base=$(basename "$rel")
  lower_base=$(lowercase "$base")

  case "$rel" in
    .git|.git/*|*/.git|*/.git/*|\
    node_modules|node_modules/*|*/node_modules|*/node_modules/*|\
    .task-artifacts|.task-artifacts/*|*/.task-artifacts|*/.task-artifacts/*|\
    .next|.next/*|*/.next|*/.next/*|\
    .nuxt|.nuxt/*|*/.nuxt|*/.nuxt/*|\
    .turbo|.turbo/*|*/.turbo|*/.turbo/*|\
    .cache|.cache/*|*/.cache|*/.cache/*|\
    coverage|coverage/*|*/coverage|*/coverage/*|\
    dist|dist/*|*/dist|*/dist/*|\
    build|build/*|*/build|*/build/*|\
    target|target/*|*/target|*/target/*|\
    out|out/*|*/out|*/out/*|\
    tmp|tmp/*|*/tmp|*/tmp/*|\
    temp|temp/*|*/temp|*/temp/*)
      return 0
      ;;
  esac

  case "$base" in
    .env)
      return 0
      ;;
    .env.*)
      if ! is_env_allowlisted "$base"; then
        return 0
      fi
      ;;
    .envrc|.npmrc|.pypirc|.netrc)
      return 0
      ;;
    id_rsa|id_rsa.pub|id_dsa|id_dsa.pub|id_ecdsa|id_ecdsa.pub|id_ed25519|id_ed25519.pub)
      return 0
      ;;
    *.pem|*.key|*.p12|*.pfx|*.crt|*.cer|*.der|*.p7b|*.p7c|*.mobileprovision)
      return 0
      ;;
    Cookies|Cookies-journal|History|History-journal|Web\ Data|Web\ Data-journal|Login\ Data|Login\ Data-journal|Current\ Session|Current\ Tabs|Last\ Session|Last\ Tabs|Network\ Persistent\ State|TransportSecurity)
      return 0
      ;;
    *.sqlite|*.sqlite3|*.db|*.db3|*.sqlite-wal|*.sqlite-shm|*.db-wal|*.db-shm)
      return 0
      ;;
  esac

  case "$rel" in
    .aws/credentials|*/.aws/credentials|.docker/config.json|*/.docker/config.json)
      return 0
      ;;
  esac

  case "$lower_base" in
    cookies.txt|cookies.json|cookie.txt|cookie.json|token.txt|token.json|tokens.json|session.txt|session.json|sessions.json|credentials.json|creds.json|auth.json|auth.token|refresh.token|access.token)
      return 0
      ;;
  esac

  return 1
}

resolve_repo_root() {
  local input repo_root
  input=$1
  [ -d "$input" ] || die "repo path must be a directory"
  repo_root=$(cd "$input" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null) || die "repo path is not inside a git work tree"
  cd "$repo_root" 2>/dev/null || die "unable to access repo root"
  pwd -P
}

resolve_output_path() {
  case "$1" in
    /*)
      printf '%s\n' "$1"
      ;;
    *)
      printf '%s/%s\n' "$(pwd -P)" "$1"
      ;;
  esac
}

path_within_repo() {
  case "$1" in
    "$REPO_ROOT"|"$REPO_ROOT"/*)
      return 0
      ;;
  esac
  return 1
}

safe_candidate_realpath() {
  local candidate_abs parent_real candidate_real base
  candidate_abs=$1
  base=$(basename "$candidate_abs")
  parent_real=$(cd "$(dirname "$candidate_abs")" 2>/dev/null && pwd -P) || return 1
  case "$parent_real" in
    "$REPO_ROOT"|"$REPO_ROOT"/*)
      ;;
    *)
      return 2
      ;;
  esac
  candidate_real=$parent_real/$base
  printf '%s\n' "$candidate_real"
}

count_regular_files() {
  find "$1" -type f -exec printf . \; | wc -c | awk '{print $1}'
}

run_gitleaks_scan() {
  local target label report rc
  target=$1
  label=$2
  report=$TEMP_ROOT/$label-gitleaks.json
  if gitleaks dir "$target" --no-banner --no-color --redact=100 --log-level error --report-format json --report-path "$report" --exit-code 17 >/dev/null 2>&1; then
    printf 'PASS\n'
    return 0
  else
    rc=$?
  fi
  if [ "$rc" -eq 17 ]; then
    die "gitleaks scan failed on $label"
  fi
  die "gitleaks command error on $label (exit $rc)"
}

REPO_ARG=
OUTPUT_ARG=
INCLUDES=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      [ "$#" -ge 2 ] || usage
      REPO_ARG=$2
      shift 2
      ;;
    --output)
      [ "$#" -ge 2 ] || usage
      OUTPUT_ARG=$2
      shift 2
      ;;
    --include)
      [ "$#" -ge 2 ] || usage
      include_value=$(normalize_include "$2") || die "include paths must stay within the repo"
      INCLUDES[${#INCLUDES[@]}]=$include_value
      shift 2
      ;;
    --help|-h)
      usage
      ;;
    *)
      usage
      ;;
  esac
done

[ -n "$REPO_ARG" ] || usage
[ -n "$OUTPUT_ARG" ] || usage

require_cmd git
require_cmd zip
require_cmd unzip
require_cmd shasum
require_cmd gitleaks

REPO_ROOT=$(resolve_repo_root "$REPO_ARG")
OUTPUT_ABS=$(resolve_output_path "$OUTPUT_ARG")
OUTPUT_DIR=$(dirname "$OUTPUT_ABS")
OUTPUT_BASE=$(basename "$OUTPUT_ABS")

case "$OUTPUT_BASE" in
  *.zip)
    ;;
  *)
    die "--output must end with .zip"
    ;;
esac

mkdir -p "$OUTPUT_DIR" || die "unable to create output directory"
OUTPUT_DIR=$(cd "$OUTPUT_DIR" 2>/dev/null && pwd -P) || die "unable to access output directory"
OUTPUT_ABS=$OUTPUT_DIR/$OUTPUT_BASE
MANIFEST_ABS=$OUTPUT_ABS.manifest.txt

[ ! -d "$OUTPUT_ABS" ] || die "--output must be a file path"
[ ! -d "$MANIFEST_ABS" ] || die "manifest path collides with a directory"

BRANCH=$(git -C "$REPO_ROOT" symbolic-ref --quiet --short HEAD 2>/dev/null || printf 'DETACHED\n')
HEAD_COMMIT=$(git -C "$REPO_ROOT" rev-parse HEAD) || die "unable to read HEAD commit"
if [ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=normal)" ]; then
  DIRTY=true
else
  DIRTY=false
fi
GITLEAKS_VERSION=$(gitleaks version 2>/dev/null | head -n 1 | tr -d '\r')

OUTPUT_BACKUP=
MANIFEST_BACKUP=
ZIP_PUBLISHED=false
MANIFEST_PUBLISHED=false
PUBLISH_ZIP_TMP=
PUBLISH_MANIFEST_TMP=

TEMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/prepare-source-packet.XXXXXX") || die "unable to create temporary directory"
STAGE_DIR=$TEMP_ROOT/stage
EXTRACT_DIR=$TEMP_ROOT/extracted
ARCHIVE_TMP=$TEMP_ROOT/archive.zip
MANIFEST_TMP=$TEMP_ROOT/manifest.txt
mkdir -p "$STAGE_DIR" "$EXTRACT_DIR"

cleanup() {
  rm -rf "$TEMP_ROOT"
  if [ -n "${PUBLISH_ZIP_TMP:-}" ]; then rm -f "$PUBLISH_ZIP_TMP"; fi
  if [ -n "${PUBLISH_MANIFEST_TMP:-}" ]; then rm -f "$PUBLISH_MANIFEST_TMP"; fi
}
trap cleanup EXIT HUP INT TERM

if path_within_repo "$OUTPUT_ABS"; then
  OUTPUT_REPO_REL=${OUTPUT_ABS#"$REPO_ROOT"/}
  git -C "$REPO_ROOT" ls-files --error-unmatch -- "$OUTPUT_REPO_REL" >/dev/null 2>&1 && die "--output points to a tracked file"
fi
if path_within_repo "$MANIFEST_ABS"; then
  MANIFEST_REPO_REL=${MANIFEST_ABS#"$REPO_ROOT"/}
  git -C "$REPO_ROOT" ls-files --error-unmatch -- "$MANIFEST_REPO_REL" >/dev/null 2>&1 && die "manifest path points to a tracked file"
fi

SELECTED_COUNT=0
while IFS= read -r -d '' rel_path; do
  [ -n "$rel_path" ] || continue
  safe_candidate_path "$rel_path" || die "refusing unsafe candidate path"
  matches_include "$rel_path" || continue
  is_disallowed_path "$rel_path" && continue

  candidate_abs=$REPO_ROOT/$rel_path
  candidate_real=$(safe_candidate_realpath "$candidate_abs") || {
    rc=$?
    if [ "$rc" -eq 2 ]; then
      die "refusing candidate outside repo boundary"
    fi
    continue
  }

  if [ "$candidate_real" = "$OUTPUT_ABS" ] || [ "$candidate_real" = "$MANIFEST_ABS" ]; then
    continue
  fi

  [ -e "$candidate_real" ] || continue
  [ -f "$candidate_real" ] || continue
  [ ! -L "$candidate_abs" ] || continue
  [ ! -L "$candidate_real" ] || continue

  destination=$STAGE_DIR/$rel_path
  mkdir -p "$(dirname "$destination")" || die "unable to create staging directory"
  cp -p "$candidate_real" "$destination" || die "unable to stage source file"
  SELECTED_COUNT=$((SELECTED_COUNT + 1))
done < <(git -C "$REPO_ROOT" ls-files --cached --others --exclude-standard -z)

[ "$SELECTED_COUNT" -gt 0 ] || die "no eligible files selected for archive"

SCAN_STAGE_STATUS=$(run_gitleaks_scan "$STAGE_DIR" staging)

(
  cd "$STAGE_DIR" || exit 1
  zip -q -X -r "$ARCHIVE_TMP" .
) || die "zip archive creation failed"

unzip -t "$ARCHIVE_TMP" >/dev/null 2>&1 || die "unzip integrity test failed"
UNZIP_TEST_STATUS=PASS

unzip -qq "$ARCHIVE_TMP" -d "$EXTRACT_DIR" >/dev/null 2>&1 || die "archive extraction verification failed"
SCAN_EXTRACT_STATUS=$(run_gitleaks_scan "$EXTRACT_DIR" extracted)

ARCHIVE_BYTES=$(wc -c < "$ARCHIVE_TMP" | awk '{print $1}')
ARCHIVE_SHA256=$(shasum -a 256 "$ARCHIVE_TMP" | awk '{print $1}')
FILE_COUNT=$(count_regular_files "$STAGE_DIR")
GENERATED_AT_UTC=$(env TZ=UTC date '+%Y-%m-%dT%H:%M:%SZ')

cat > "$MANIFEST_TMP" <<EOF
generated_at_utc=$GENERATED_AT_UTC
repo=$REPO_ROOT
branch=$BRANCH
head_commit=$HEAD_COMMIT
dirty=$DIRTY
archive_bytes=$ARCHIVE_BYTES
archive_sha256=$ARCHIVE_SHA256
file_count=$FILE_COUNT
gitleaks_version=$GITLEAKS_VERSION
gitleaks_stage_scan=$SCAN_STAGE_STATUS
unzip_test=$UNZIP_TEST_STATUS
gitleaks_extracted_scan=$SCAN_EXTRACT_STATUS
EOF

if [ -e "$OUTPUT_ABS" ]; then
  OUTPUT_BACKUP=$TEMP_ROOT/output.backup
  cp -p "$OUTPUT_ABS" "$OUTPUT_BACKUP" || die "unable to back up existing output"
fi
if [ -e "$MANIFEST_ABS" ]; then
  MANIFEST_BACKUP=$TEMP_ROOT/manifest.backup
  cp -p "$MANIFEST_ABS" "$MANIFEST_BACKUP" || die "unable to back up existing manifest"
fi

PUBLISH_ZIP_TMP=$(mktemp "$OUTPUT_DIR/.${OUTPUT_BASE}.publish.XXXXXX") || die "unable to create publish temp for archive"
PUBLISH_MANIFEST_TMP=$(mktemp "$OUTPUT_DIR/.${OUTPUT_BASE}.manifest.publish.XXXXXX") || {
  rm -f "$PUBLISH_ZIP_TMP"
  die "unable to create publish temp for manifest"
}

cp -p "$ARCHIVE_TMP" "$PUBLISH_ZIP_TMP" || die "unable to stage archive for publish"
cp -p "$MANIFEST_TMP" "$PUBLISH_MANIFEST_TMP" || die "unable to stage manifest for publish"

mv -f "$PUBLISH_ZIP_TMP" "$OUTPUT_ABS" || die "unable to publish archive"
ZIP_PUBLISHED=true
PUBLISH_ZIP_TMP=
mv -f "$PUBLISH_MANIFEST_TMP" "$MANIFEST_ABS" || publish_fail "unable to publish manifest"
MANIFEST_PUBLISHED=true
PUBLISH_MANIFEST_TMP=

printf 'zip=%s\n' "$OUTPUT_ABS"
printf 'manifest=%s\n' "$MANIFEST_ABS"
printf 'commit=%s\n' "$HEAD_COMMIT"
printf 'bytes=%s\n' "$ARCHIVE_BYTES"
printf 'sha256=%s\n' "$ARCHIVE_SHA256"
printf 'file_count=%s\n' "$FILE_COUNT"
printf 'validation=%s,%s,%s\n' "$SCAN_STAGE_STATUS" "$UNZIP_TEST_STATUS" "$SCAN_EXTRACT_STATUS"
