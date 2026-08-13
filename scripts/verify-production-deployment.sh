#!/usr/bin/env bash
set -Eeuo pipefail

PHASE="${1:-}"
PUBLIC_IP="${2:-}"
CURRENT_CHECK="bootstrap"
FAILURE_REPORTED=0

report_unexpected_failure() {
  local status="$?"
  if [ "$FAILURE_REPORTED" -eq 0 ]; then
    printf 'ECONOMY_DEPLOY_VERIFY_FAILED phase=%s check=%s exit=%s\n' "$PHASE" "$CURRENT_CHECK" "$status" >&2
  fi
  exit "$status"
}
trap report_unexpected_failure ERR

fail_check() {
  local status="$1"
  shift
  FAILURE_REPORTED=1
  printf 'ECONOMY_DEPLOY_VERIFY_FAILED phase=%s check=%s exit=%s' "$PHASE" "$CURRENT_CHECK" "$status" >&2
  if [ "$#" -gt 0 ]; then
    printf ' detail=%s' "$*" >&2
  fi
  printf '\n' >&2
  return "$status"
}

run_check() {
  local check_name="$1"
  shift
  CURRENT_CHECK="$check_name"
  printf 'ECONOMY_DEPLOY_VERIFY_START phase=%s check=%s\n' "$PHASE" "$CURRENT_CHECK"
  if "$@"; then
    printf 'ECONOMY_DEPLOY_VERIFY_OK phase=%s check=%s\n' "$PHASE" "$CURRENT_CHECK"
    return 0
  fi
  local status="$?"
  fail_check "$status"
}

require_public_ipv4() {
  python3 - "$PUBLIC_IP" <<'PYTHON'
import ipaddress
import sys
value = sys.argv[1]
address = ipaddress.ip_address(value)
if not isinstance(address, ipaddress.IPv4Address) or not address.is_global:
    raise SystemExit(1)
PYTHON
}

check_runtime_node() {
  test -x /var/www/game/economy-api/runtime/bin/node
}

check_api_health() {
  curl --fail --silent --show-error http://127.0.0.1:3002/health >/dev/null
}

check_formal_domain_nginx() {
  curl --fail --silent --show-error -H 'Host: game.riversoft.top' http://127.0.0.1/economy/ >/dev/null
}

check_current_entry() {
  test -s /var/www/game/economy/index.html
}

check_registration_secret() {
  test -s /var/lib/riversoft-economy/registration-secret
}

check_ip_certificate() {
  local slug="${PUBLIC_IP//./-}"
  test -s "/etc/letsencrypt/live/riversoft-economy-ip-${slug}/fullchain.pem"
  test -s "/etc/letsencrypt/live/riversoft-economy-ip-${slug}/privkey.pem"
}

check_renew_timer_enabled() {
  systemctl is-enabled --quiet riversoft-economy-ip-cert-renew.timer
}

check_renew_timer_active() {
  systemctl is-active --quiet riversoft-economy-ip-cert-renew.timer
}

check_database_incremental() {
  python3 - <<'PYTHON'
import sqlite3

database = '/var/lib/riversoft-economy/economy.sqlite'
with sqlite3.connect(f'file:{database}?mode=ro', uri=True) as connection:
    connection.execute('PRAGMA query_only = ON')
    auto_vacuum = int(connection.execute('PRAGMA auto_vacuum').fetchone()[0])
    quick_check = str(connection.execute('PRAGMA quick_check(1)').fetchone()[0])
if auto_vacuum != 2:
    print(f'ECONOMY_DATABASE_AUTO_VACUUM_INVALID={auto_vacuum}', file=__import__('sys').stderr)
    raise SystemExit(1)
if quick_check != 'ok':
    print(f'ECONOMY_DATABASE_QUICK_CHECK_FAILED={quick_check}', file=__import__('sys').stderr)
    raise SystemExit(1)
PYTHON
}

check_http_redirect() {
  local status
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "http://${PUBLIC_IP}/economy/" || true)"
  if [ "$status" != "308" ]; then
    printf 'ECONOMY_IP_HTTP_REDIRECT_INVALID=%s\n' "$status" >&2
    return 1
  fi
}

check_https_page() {
  curl --fail --silent --show-error --retry 3 --retry-delay 2 "https://${PUBLIC_IP}/economy/" >/dev/null
}

check_status() {
  local check_name="$1"
  local output_file="$2"
  local expected_csv="$3"
  shift 3
  CURRENT_CHECK="$check_name"
  printf 'ECONOMY_DEPLOY_VERIFY_START phase=%s check=%s\n' "$PHASE" "$CURRENT_CHECK"
  local status
  status="$(curl --silent --show-error --output "$output_file" --write-out '%{http_code}' "$@" || true)"
  case ",${expected_csv}," in
    *",${status},"*)
      printf 'ECONOMY_DEPLOY_VERIFY_OK phase=%s check=%s status=%s\n' "$PHASE" "$CURRENT_CHECK" "$status"
      return 0
      ;;
  esac
  cat "$output_file" 2>/dev/null || true
  fail_check 1 "status=${status:-none} expected=$expected_csv"
}

verify_remote() {
  run_check public-ip require_public_ipv4
  run_check runtime-node check_runtime_node
  run_check api-health check_api_health
  run_check formal-domain-nginx check_formal_domain_nginx
  run_check current-entry check_current_entry
  run_check registration-secret check_registration_secret
  run_check ip-certificate check_ip_certificate
  run_check renew-timer-enabled check_renew_timer_enabled
  run_check renew-timer-active check_renew_timer_active
  run_check database-incremental check_database_incremental
}

verify_public() {
  run_check public-ip require_public_ipv4
  run_check http-redirect check_http_redirect
  run_check https-page check_https_page
  check_status account-proxy /tmp/economy-auth-response.json '200,401' "https://${PUBLIC_IP}/economy-api/me"
  check_status game-api /tmp/economy-game-response.json '401' "https://${PUBLIC_IP}/economy-api/game/state"
  check_status login-api /tmp/economy-login-response.json '400' --request POST --header 'Content-Type: application/json' --data '{}' "https://${PUBLIC_IP}/economy-api/login"
  check_status registration-api /tmp/economy-registration-response.json '400' --request POST --header 'Content-Type: application/json' --header 'Idempotency-Key: deploy-registration-route-check' --data '{}' "https://${PUBLIC_IP}/economy-api/registration/email-code"
}

case "$PHASE" in
  remote)
    verify_remote
    ;;
  public)
    verify_public
    ;;
  *)
    printf 'Usage: %s <remote|public> <public-ip>\n' "$0" >&2
    exit 2
    ;;
esac

printf 'ECONOMY_DEPLOY_VERIFY_COMPLETE phase=%s\n' "$PHASE"
