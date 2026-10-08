#!/bin/bash
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && /bin/pwd -P)"
SOURCE_ROOT="$PLUGIN_ROOT/assets/macos-app"
BUILD_ROOT="${BUILD_ROOT:-$PLUGIN_ROOT/build}"
APP_BUNDLE="$BUILD_ROOT/Career Command Center.app"
EXECUTABLE="$APP_BUNDLE/Contents/MacOS/CareerCommandCenter"
MODULE_CACHE="$BUILD_ROOT/.module-cache"
BUILD_LOG="$BUILD_ROOT/swift-build.log"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Career Command Center is currently a macOS application." >&2
  exit 2
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun is required to build the app from source." >&2
  exit 2
fi

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources" "$MODULE_CACHE"

SOURCES=(
  "$SOURCE_ROOT/Sources/CoreModels.swift"
  "$SOURCE_ROOT/Sources/AppStore.swift"
  "$SOURCE_ROOT/Sources/DesignSystem.swift"
  "$SOURCE_ROOT/Sources/OnboardingView.swift"
  "$SOURCE_ROOT/Sources/LeadWorkspaceView.swift"
  "$SOURCE_ROOT/Sources/LibraryViews.swift"
  "$SOURCE_ROOT/Sources/QuestionsView.swift"
  "$SOURCE_ROOT/Sources/CareerCommandCenterApp.swift"
)

SWIFT_ARGS=(
  -swift-version 5 \
  -parse-as-library \
  -O \
  -target "$(uname -m)-apple-macos14.0" \
  -module-cache-path "$MODULE_CACHE" \
  -framework SwiftUI \
  -framework AppKit \
  -framework Foundation \
  "${SOURCES[@]}" \
  -o "$EXECUTABLE"
)

if ! MACOSX_DEPLOYMENT_TARGET=14.0 \
  CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" \
  SWIFT_MODULE_CACHE_PATH="$MODULE_CACHE" \
  xcrun swiftc "${SWIFT_ARGS[@]}" 2>"$BUILD_LOG"; then
  if ! grep -q "SDK is not supported by the compiler" "$BUILD_LOG"; then
    cat "$BUILD_LOG" >&2
    exit 1
  fi

  # Some macOS CLT updates briefly ship a compiler and SDK with different patch
  # identifiers. Retrying with their shared semantic version is safe for that
  # narrow mismatch and keeps source installs working while Apple catches up.
  SWIFT_INTERFACE_VERSION="$(xcrun swiftc --version | sed -nE 's/.*Apple Swift version ([0-9]+\.[0-9]+(\.[0-9]+)?).*/\1/p' | head -n 1)"
  if [[ -z "$SWIFT_INTERFACE_VERSION" ]]; then
    cat "$BUILD_LOG" >&2
    exit 1
  fi

  echo "Retrying after a local Swift compiler/SDK patch-version mismatch." >&2
  if ! MACOSX_DEPLOYMENT_TARGET=14.0 \
    CLANG_MODULE_CACHE_PATH="$MODULE_CACHE" \
    SWIFT_MODULE_CACHE_PATH="$MODULE_CACHE" \
    xcrun swiftc "${SWIFT_ARGS[@]}" \
      -Xfrontend -interface-compiler-version \
      -Xfrontend "$SWIFT_INTERFACE_VERSION" 2>>"$BUILD_LOG"; then
    cat "$BUILD_LOG" >&2
    exit 1
  fi
fi

rm -f "$BUILD_LOG"

cp "$SOURCE_ROOT/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
cp "$SOURCE_ROOT/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
chmod +x "$EXECUTABLE"
codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null

echo "$APP_BUNDLE"
