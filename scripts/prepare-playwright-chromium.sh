#!/usr/bin/env bash
set -euo pipefail

if [ -z "${GITHUB_ENV:-}" ]; then
  echo 'ECONOMY_PLAYWRIGHT_BROWSER_ERROR=GITHUB_ENV_MISSING'
  exit 2
fi

chrome_path=''
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then
    chrome_path="$(command -v "$candidate")"
    break
  fi
done

if [ -n "$chrome_path" ]; then
  "$chrome_path" --version
  printf 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=%s\n' "$chrome_path" >> "$GITHUB_ENV"
  echo "ECONOMY_PLAYWRIGHT_BROWSER_SOURCE=runner executable=$chrome_path"
  exit 0
fi

echo 'ECONOMY_PLAYWRIGHT_BROWSER_SOURCE=download'
npx playwright install --with-deps chromium
