#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/curl" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
count_file="${ECONOMY_FAKE_CURL_COUNT_FILE:?}"
count=0
if [ -f "$count_file" ]; then count="$(cat "$count_file")"; fi
count=$((count + 1))
printf '%s' "$count" > "$count_file"
status="${ECONOMY_FAKE_CURL_STATUS_SEQUENCE:-000}"
IFS=',' read -r -a values <<< "$status"
index=$((count - 1))
if [ "$index" -ge "${#values[@]}" ]; then index=$((${#values[@]} - 1)); fi
value="${values[$index]}"
output_file=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) output_file="$2"; shift 2 ;;
    --write-out) shift 2 ;;
    *) shift ;;
  esac
done
[ -z "$output_file" ] || : > "$output_file"
printf '%s' "$value"
SH
chmod +x "$TMP/curl"

extract_function() {
  local name="$1"
  awk -v name="$name" '
    $0 == name "() {" { active=1 }
    active { print }
    active && $0 == "}" { exit }
  ' "$ROOT/scripts/verify-production-deployment.sh"
}

run_case() {
  local sequence="$1"
  local expected_exit="$2"
  local expected_calls="$3"
  local expected_marker="$4"
  local count_file="$TMP/count"
  : > "$count_file"
  local harness="$TMP/harness.sh"
  {
    printf '%s\n' '#!/usr/bin/env bash' 'set -Eeuo pipefail'
    printf '%s\n' 'PHASE=public' 'CURRENT_CHECK=bootstrap' 'FAILURE_REPORTED=0'
    grep '^FORMAL_DOMAIN_' "$ROOT/scripts/verify-production-deployment.sh"
    extract_function fail_check
    extract_function check_formal_domain_status
    printf '%s\n' 'check_formal_domain_status formal-domain-page /tmp/fake-response.json "200" TEST_FORMAL_DOMAIN https://game.riversoft.top/economy/'
  } > "$harness"
  chmod +x "$harness"

  set +e
  output="$(PATH="$TMP:$PATH" ECONOMY_FAKE_CURL_COUNT_FILE="$count_file" ECONOMY_FAKE_CURL_STATUS_SEQUENCE="$sequence" "$harness" 2>&1)"
  status=$?
  set -e
  if [ "$status" -ne "$expected_exit" ]; then
    printf 'case %s exit=%s expected=%s\n%s\n' "$sequence" "$status" "$expected_exit" "$output" >&2
    exit 1
  fi
  calls="$(cat "$count_file")"
  if [ "$calls" -ne "$expected_calls" ]; then
    printf 'case %s calls=%s expected=%s\n%s\n' "$sequence" "$calls" "$expected_calls" "$output" >&2
    exit 1
  fi
  if ! grep -Fq "$expected_marker" <<< "$output"; then
    printf 'case %s missing marker %s\n%s\n' "$sequence" "$expected_marker" "$output" >&2
    exit 1
  fi
}

run_case '000,200' 0 2 'ECONOMY_FORMAL_DOMAIN_RECOVERED'
run_case '000,000,000' 1 3 'ECONOMY_FORMAL_DOMAIN_RETRY_EXHAUSTED'
run_case '503' 1 1 'TEST_FORMAL_DOMAIN status=503 expected=200'

echo '正式域名公网验收重试行为测试通过：000 有界重试，非预期 HTTP 状态立即失败。'
