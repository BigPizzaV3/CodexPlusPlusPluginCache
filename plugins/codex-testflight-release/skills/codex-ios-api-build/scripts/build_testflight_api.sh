#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <build-number>" >&2
  exit 2
fi

BUILD_NUMBER="$1"
PROJECT_PATH="${PROJECT_PATH:-}"
SCHEME="${SCHEME:-}"
CONFIGURATION="${CONFIGURATION:-Release}"
EXPORT_OPTIONS="${EXPORT_OPTIONS:-}"
ENV_FILE="${ASC_ENV_FILE:-$HOME/.private_keys/appstoreconnect.env}"
ARCHIVE_PATH="${ARCHIVE_PATH:-$PWD/build/${SCHEME}-${BUILD_NUMBER}.xcarchive}"
EXPORT_PATH="${EXPORT_PATH:-$PWD/build/${SCHEME}-${BUILD_NUMBER}-export}"

if [[ -z "$PROJECT_PATH" || -z "$SCHEME" || -z "$EXPORT_OPTIONS" ]]; then
  echo "PROJECT_PATH, SCHEME, and EXPORT_OPTIONS are required." >&2
  exit 2
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing App Store Connect env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [[ -z "${ASC_KEY_ID:-}" || -z "${ASC_ISSUER_ID:-}" || -z "${ASC_KEY_PATH:-}" ]]; then
  echo "ASC_KEY_ID, ASC_ISSUER_ID, and ASC_KEY_PATH are required." >&2
  exit 1
fi

if [[ ! -f "$ASC_KEY_PATH" ]]; then
  echo "Missing App Store Connect private key at ASC_KEY_PATH." >&2
  exit 1
fi

if [[ ! -f "$EXPORT_OPTIONS" ]]; then
  echo "Missing export options plist: $EXPORT_OPTIONS" >&2
  exit 1
fi

INTERNAL_ONLY=$(/usr/libexec/PlistBuddy -c 'Print :testFlightInternalTestingOnly' "$EXPORT_OPTIONS" 2>/dev/null || echo false)
if [[ -n "${ASC_BETA_GROUP:-}" && "$INTERNAL_ONLY" == "true" ]]; then
  echo "External TestFlight group '$ASC_BETA_GROUP' is configured, but $EXPORT_OPTIONS sets testFlightInternalTestingOnly=true." >&2
  echo "Set it to false or remove the key before building." >&2
  exit 1
fi

if ! grep -q "BEGIN PRIVATE KEY" "$ASC_KEY_PATH" || ! grep -q "END PRIVATE KEY" "$ASC_KEY_PATH"; then
  echo "ASC private key does not look like a valid .p8 file." >&2
  exit 1
fi

PROJECT_FILE="$PROJECT_PATH/project.pbxproj"
if [[ ! -f "$PROJECT_FILE" ]]; then
  echo "Cannot find project file: $PROJECT_FILE" >&2
  exit 1
fi

python3 - "$PROJECT_FILE" "$BUILD_NUMBER" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
build = sys.argv[2]
text = path.read_text()
new = re.sub(r"CURRENT_PROJECT_VERSION = [^;]+;", f"CURRENT_PROJECT_VERSION = {build};", text)
if new == text:
    raise SystemExit("No CURRENT_PROJECT_VERSION entries found.")
path.write_text(new)
PY

rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive

APP_INFO="$ARCHIVE_PATH/Products/Applications/${SCHEME}.app/Info.plist"
if [[ -f "$APP_INFO" ]]; then
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_INFO"
  /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_INFO"
  /usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_INFO"
  /usr/libexec/PlistBuddy -c 'Print :ITSAppUsesNonExemptEncryption' "$APP_INFO" || {
    echo "Warning: ITSAppUsesNonExemptEncryption is not present in archived Info.plist." >&2
  }
fi

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS" \
  -exportPath "$EXPORT_PATH" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

echo "Uploaded ${SCHEME} build ${BUILD_NUMBER} to App Store Connect."
