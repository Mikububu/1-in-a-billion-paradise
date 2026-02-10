#!/usr/bin/env bash
# Build and install "1 In A Billion Cursor" on the iOS Simulator (Mac).
# Run from project root: bash scripts/run-ios-simulator.sh
# Uses xcodebuild so no device code signing is required.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Building for iOS Simulator (iPhone 17 Pro)..."
echo "First build may take 10–15 minutes."
echo ""

# Build for simulator (no signing needed)
xcodebuild -workspace ios/1InABillionCursor.xcworkspace \
  -scheme 1InABillionCursor \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.1' \
  -configuration Debug \
  build

# Find the built .app and install on booted simulator
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/1InABillionCursor-*/Build/Products/Debug-iphonesimulator -name "1InABillionCursor.app" -type d | head -1)
if [[ -z "$APP_PATH" ]]; then
  echo "Could not find built .app. Install manually from Xcode."
  exit 1
fi

BOOTED_UDID=$(xcrun simctl list devices | grep "Booted" | head -1 | grep -oE '[A-F0-9-]{36}' | head -1)
if [[ -z "$BOOTED_UDID" ]]; then
  echo "No simulator booted. Booting iPhone 17 Pro..."
  xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
  BOOTED_UDID=$(xcrun simctl list devices | grep "iPhone 17 Pro" | grep "26.1" | head -1 | grep -oE '[A-F0-9-]{36}' | head -1)
fi

echo "Installing app on simulator..."
xcrun simctl install "$BOOTED_UDID" "$APP_PATH"
xcrun simctl launch "$BOOTED_UDID" com.oneinabillion.app

echo ""
echo "Done. App '1 In A Billion Cursor' should be open on the simulator."
