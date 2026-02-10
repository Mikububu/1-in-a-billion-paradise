#!/usr/bin/env bash
# Build and run "1 In A Billion Cursor" on the Android emulator.
# Run from frontend root: bash scripts/run-android-emulator.sh
#
# One-time setup (Mac):
#   1. Install Android Studio: https://developer.android.com/studio
#   2. Open Android Studio → More Actions → Virtual Device Manager
#   3. Create Device → pick a phone (e.g. Pixel 8) → pick a system image (e.g. API 35) → Finish
#   4. Start the emulator from the Device Manager (play button), or it will be started below.
#
# Use the project path WITHOUT spaces (same as iOS):
#   cd "/Users/michaelperinwogenburg/Desktop/big-challenge/1-in-a-Billion/1-in-a-billion-frontend"

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ANDROID_HOME is not set. Install Android Studio and add SDK to your PATH."
  echo "  e.g. export ANDROID_HOME=\$HOME/Library/Android/sdk"
  exit 1
fi

ADB="${ANDROID_HOME}/platform-tools/adb"
if [[ ! -x "$ADB" ]]; then
  echo "adb not found at $ADB. Install Android SDK platform-tools."
  exit 1
fi

# If no device/emulator is running, try to start one
RUNNING=$("$ADB" devices 2>/dev/null | grep -c "device$" || true)
if [[ "$RUNNING" -eq 0 ]]; then
  echo "No Android device or emulator running. Starting default emulator..."
  if command -v emulator &>/dev/null; then
    # Start first available AVD in background
    AVD=$("$ANDROID_HOME/emulator/emulator" -list-avds 2>/dev/null | head -1)
    if [[ -z "$AVD" ]]; then
      echo "No AVD found. Create one in Android Studio: Virtual Device Manager → Create Device."
      exit 1
    fi
    "$ANDROID_HOME/emulator/emulator" -avd "$AVD" &
    echo "Waiting for emulator to boot (30s)..."
    sleep 30
  else
    echo "Start an emulator from Android Studio (Device Manager), then run this script again."
    exit 1
  fi
fi

echo "=== Building and running on Android (expo run:android) ==="
echo "Metro must be running in another terminal for the app to load:"
echo "  cd $(pwd) && npx expo start"
echo ""
npx expo run:android
