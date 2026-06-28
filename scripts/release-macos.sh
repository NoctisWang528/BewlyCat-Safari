#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SEARCH_ROOT="${REPO_ROOT}/extension-safari-macos"
OUTPUT_DIR="${REPO_ROOT}/release"

usage() {
  cat <<'EOF'
Usage:
  pnpm release:macos -- <version> [path-to-app]

Examples:
  pnpm release:macos -- v1.6.7-safari.3 "/path/to/BewlyCat Safari.app"
  BEWLYCAT_APP_PATH="/path/to/BewlyCat Safari.app" pnpm release:macos -- v1.6.7-safari.3

The app path may be omitted only when exactly one .app can be found under
extension-safari-macos/. Xcode commonly writes build products to DerivedData,
so passing the exported or archived host app path explicitly is recommended.
EOF
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 2
fi

VERSION="$1"
if [[ "${VERSION}" != v* ]]; then
  VERSION="v${VERSION}"
fi

if [[ ! "${VERSION}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+-safari\.[1-9][0-9]*$ ]]; then
  fail "Invalid version '${VERSION}'. Use the upstream base plus Safari revision, such as v1.6.7-safari.3."
fi

[[ "$(uname -s)" == "Darwin" ]] || fail "This release script requires macOS."
command -v pnpm >/dev/null 2>&1 || fail "pnpm was not found. Install the repository-pinned pnpm version first."
command -v ditto >/dev/null 2>&1 || fail "ditto was not found. Run this script on macOS."
command -v shasum >/dev/null 2>&1 || fail "shasum was not found."

APP_PATH="${2:-${BEWLYCAT_APP_PATH:-}}"

if [[ -z "${APP_PATH}" ]]; then
  APP_CANDIDATES=()
  if [[ -d "${SEARCH_ROOT}" ]]; then
    while IFS= read -r candidate; do
      APP_CANDIDATES[${#APP_CANDIDATES[@]}]="${candidate}"
    done < <(find "${SEARCH_ROOT}" -type d -name '*.app' -prune -print)
  fi

  if [[ ${#APP_CANDIDATES[@]} -eq 1 ]]; then
    APP_PATH="${APP_CANDIDATES[0]}"
  elif [[ ${#APP_CANDIDATES[@]} -eq 0 ]]; then
    fail "No .app found under '${SEARCH_ROOT}'. Build/export the macOS host app in Xcode, then pass its path as the second argument or set BEWLYCAT_APP_PATH."
  else
    printf 'ERROR: Multiple .app bundles were found. Pass the intended host app path explicitly:\n' >&2
    printf '  %s\n' "${APP_CANDIDATES[@]}" >&2
    exit 1
  fi
fi

if [[ "${APP_PATH}" != /* ]]; then
  APP_PATH="${REPO_ROOT}/${APP_PATH}"
fi

[[ -d "${APP_PATH}" ]] || fail "App bundle does not exist: ${APP_PATH}"
[[ "${APP_PATH}" == *.app ]] || fail "Expected a .app bundle, got: ${APP_PATH}"
[[ -f "${APP_PATH}/Contents/Info.plist" ]] || fail "Invalid app bundle (Contents/Info.plist is missing): ${APP_PATH}"

cd "${REPO_ROOT}"

printf 'Building Safari WebExtension...\n'
pnpm build

printf 'Validating Safari WebExtension...\n'
pnpm validate-safari

ARCHIVE_NAME="BewlyCat-Safari-${VERSION}-macOS.zip"
ARCHIVE_PATH="${OUTPUT_DIR}/${ARCHIVE_NAME}"
CHECKSUM_PATH="${OUTPUT_DIR}/SHA256SUMS.txt"

mkdir -p "${OUTPUT_DIR}"
rm -f "${ARCHIVE_PATH}" "${CHECKSUM_PATH}"

printf 'Packaging host app: %s\n' "${APP_PATH}"
ditto -c -k --keepParent "${APP_PATH}" "${ARCHIVE_PATH}"

(
  cd "${OUTPUT_DIR}"
  shasum -a 256 "${ARCHIVE_NAME}" > "SHA256SUMS.txt"
)

if command -v codesign >/dev/null 2>&1 && codesign --verify --deep --strict "${APP_PATH}" >/dev/null 2>&1; then
  SIGNING_STATUS="codesign verification passed (this does not prove notarization)"
else
  SIGNING_STATUS="unsigned or codesign verification did not pass"
fi

printf '\nRelease assets created:\n'
printf '  %s\n' "${ARCHIVE_PATH}"
printf '  %s\n' "${CHECKSUM_PATH}"
printf 'Signing status: %s\n' "${SIGNING_STATUS}"
printf '\nNext steps:\n'
printf '  1. Test the zip on a clean macOS user or machine.\n'
printf '  2. If this is a formal release, sign with Developer ID and notarize before publishing.\n'
printf '  3. Create and push the tag: git tag %s && git push origin %s\n' "${VERSION}" "${VERSION}"
printf '  4. Create a GitHub Release for %s and upload both files above.\n' "${VERSION}"
