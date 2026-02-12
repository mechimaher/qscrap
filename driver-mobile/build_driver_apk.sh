#!/bin/bash
# ================================================================
# QScrap Driver App — Enterprise Clean APK Build Script
# Senior Android Engineering Standards — Feb 2026
# 
# One-click: validates → cleans → installs → prebuilds → builds
# Produces a verified, signed release APK with build manifest
# ================================================================
set -euo pipefail
IFS=$'\n\t'

# ---- Build Timer ----
BUILD_START=$(date +%s)
BUILD_DATE=$(date '+%Y-%m-%d %H:%M:%S')

# ---- Color Output ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${BLUE}${BOLD}[$1/8]${NC} ${BOLD}$2${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
fail() { echo -e "  ${RED}x${NC} $1"; exit 1; }

# ---- Environment Setup ----
export ANDROID_HOME="${ANDROID_HOME:-/home/user/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
ulimit -n 65536 2>/dev/null || true

# Navigate to driver-mobile dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---- Banner ----
echo ""
echo -e "${BOLD}=============================================="
echo "  QScrap Driver APK — Enterprise Clean Build"
echo "==============================================${NC}"
echo "  Directory : $(pwd)"
echo "  Time      : $BUILD_DATE"
echo "  Node      : $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "  Java      : $(java -version 2>&1 | head -1)"
echo "  NPM       : $(npm -v 2>/dev/null || echo 'NOT FOUND')"
echo "=============================================="

# ---- Step 1: Pre-Build Validation ----
step 1 "Pre-build validation..."

# Check Java
if ! java -version 2>&1 | grep -q "17"; then
    fail "Java 17 required. Found: $(java -version 2>&1 | head -1)"
fi
ok "Java 17 verified"

# Check Android SDK
if [ ! -d "$ANDROID_HOME/platforms" ]; then
    fail "Android SDK not found at $ANDROID_HOME"
fi
ok "Android SDK found"

# Check Node
if ! command -v node &>/dev/null; then
    fail "Node.js not found in PATH"
fi
ok "Node.js $(node -v) verified"

# TypeScript pre-flight check
echo "  Checking TypeScript compilation..."
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    fail "TypeScript errors found! Fix before building."
fi
ok "TypeScript — 0 errors"

# Read version from app.json
APP_VERSION=$(node -e "console.log(require('./app.json').expo.version)" 2>/dev/null || echo "unknown")
APP_NAME=$(node -e "console.log(require('./app.json').expo.name)" 2>/dev/null || echo "QScrap Driver")
ok "App: $APP_NAME v$APP_VERSION"

# Check for dev API URLs
API_FILE="src/config/api.ts"
if [ -f "$API_FILE" ] && grep -q "192.168" "$API_FILE" 2>/dev/null; then
    warn "Development API URL detected in $API_FILE — verify this is intentional"
fi

# ---- Step 2: Nuke ALL Caches ----
step 2 "Clearing ALL caches (deep clean)..."

rm -rf android/ ios/ 2>/dev/null || true
ok "Native project directories removed"

rm -rf .expo/ 2>/dev/null || true
rm -rf /tmp/metro-* /tmp/expo-* /tmp/haste-* /tmp/react-native-* 2>/dev/null || true
ok "Metro/Expo caches cleared"

rm -rf "$HOME/.gradle/caches/transforms-"* 2>/dev/null || true
rm -rf "$HOME/.gradle/daemon" 2>/dev/null || true
ok "Gradle transform caches cleared"

rm -rf node_modules/.cache 2>/dev/null || true
ok "Node module caches cleared"

# ---- Step 3: Install Dependencies ----
step 3 "Installing dependencies (clean install)..."

rm -rf node_modules package-lock.json 2>/dev/null || true
npm install --legacy-peer-deps 2>&1 | tail -3
ok "Dependencies installed"

# ---- Step 4: Expo Prebuild ----
step 4 "Running Expo Prebuild (generating Android project)..."

npx expo prebuild --platform android --clean 2>&1 | tail -5
ok "Android project generated from app.json"

# ---- Step 5: Configure Gradle for Optimal Build ----
step 5 "Configuring Gradle build environment..."

if [ ! -d "android" ]; then
    fail "android/ directory not found after prebuild!"
fi

GRADLE_PROPS="android/gradle.properties"
if [ -f "$GRADLE_PROPS" ]; then
    sed -i '/org.gradle.jvmargs/d' "$GRADLE_PROPS"
    sed -i '/org.gradle.parallel/d' "$GRADLE_PROPS"
fi

# Use printf to ensure newline before appending (prevents concatenation with last line)
printf '\n\n# Enterprise Build Optimization (auto-generated)\norg.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError\norg.gradle.parallel=false\norg.gradle.caching=false\n' >> "$GRADLE_PROPS"
ok "Gradle JVM: 8GB heap, 2GB metaspace"

mkdir -p android/temp_build
export GRADLE_OPTS="-Djava.io.tmpdir=$(pwd)/android/temp_build -Dorg.gradle.vfs.watch=false"
ok "Build temp directory configured"

# ---- Step 6: Stop Existing Gradle Daemons ----
step 6 "Stopping stale Gradle daemons..."

cd android
./gradlew --stop 2>/dev/null || true
ok "Gradle daemons cleared"

# ---- Step 7: Build Release APK ----
step 7 "Building Release APK (this takes 5-15 minutes)..."

GRADLE_START=$(date +%s)

./gradlew assembleRelease \
    --console=plain \
    --no-daemon \
    --no-build-cache \
    --warning-mode=none \
    -Dorg.gradle.workers.max=2

GRADLE_EXIT=$?
GRADLE_END=$(date +%s)
GRADLE_DURATION=$((GRADLE_END - GRADLE_START))

cd ..

if [ $GRADLE_EXIT -ne 0 ]; then
    fail "Gradle build failed (exit code: $GRADLE_EXIT). Check output above."
fi
ok "Gradle build completed in ${GRADLE_DURATION}s"

# ---- Step 8: Verify, Copy & Generate Build Manifest ----
step 8 "Verifying and packaging APK..."

APK_SOURCE="android/app/build/outputs/apk/release/app-release.apk"

if [ ! -f "$APK_SOURCE" ]; then
    warn "APK not found at expected path. Searching..."
    APK_SOURCE=$(find android/ -name "*.apk" -path "*/release/*" 2>/dev/null | head -1)
    if [ -z "$APK_SOURCE" ]; then
        fail "No release APK found anywhere in android/build/"
    fi
    ok "Found APK at: $APK_SOURCE"
fi

# Copy to project root with versioned name
APK_OUTPUT="../QScrapDriver-v${APP_VERSION}.apk"
cp "$APK_SOURCE" "$APK_OUTPUT"

# Also copy without version for convenience
cp "$APK_SOURCE" "../QScrapDriver.apk"

# Calculate metrics
APK_SIZE=$(ls -lh "$APK_OUTPUT" | awk '{print $5}')
APK_SIZE_BYTES=$(stat -c%s "$APK_OUTPUT" 2>/dev/null || stat -f%z "$APK_OUTPUT" 2>/dev/null)
APK_SHA256=$(sha256sum "$APK_OUTPUT" | awk '{print $1}')
BUILD_END=$(date +%s)
TOTAL_DURATION=$((BUILD_END - BUILD_START))
TOTAL_MINUTES=$((TOTAL_DURATION / 60))
TOTAL_SECONDS=$((TOTAL_DURATION % 60))

# Generate build manifest
BUILD_MANIFEST="../QScrapDriver-build-manifest.txt"
cat > "$BUILD_MANIFEST" << MANIFEST
===========================================
 QScrap Driver APK — Build Manifest
===========================================
App Name      : $APP_NAME
Version       : $APP_VERSION
Build Date    : $BUILD_DATE
Build Duration: ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s
-------------------------------------------
APK File      : QScrapDriver-v${APP_VERSION}.apk
APK Size      : $APK_SIZE ($APK_SIZE_BYTES bytes)
SHA-256       : $APK_SHA256
-------------------------------------------
Node.js       : $(node -v)
Java          : $(java -version 2>&1 | head -1)
Expo SDK      : $(node -e "console.log(require('./package.json').dependencies.expo)" 2>/dev/null)
React Native  : $(node -e "console.log(require('./package.json').dependencies['react-native'])" 2>/dev/null)
-------------------------------------------
Build Machine : $(hostname)
Build User    : $(whoami)
===========================================
MANIFEST

# ---- Final Summary ----
echo ""
echo -e "${GREEN}${BOLD}=============================================="
echo "  BUILD SUCCESS"
echo "==============================================${NC}"
echo ""
echo -e "  ${BOLD}APK:${NC}       QScrapDriver-v${APP_VERSION}.apk"
echo -e "  ${BOLD}Size:${NC}      $APK_SIZE"
echo -e "  ${BOLD}SHA-256:${NC}   ${APK_SHA256:0:16}..."
echo -e "  ${BOLD}Duration:${NC}  ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s"
echo -e "  ${BOLD}Manifest:${NC}  QScrapDriver-build-manifest.txt"
echo ""
echo -e "  ${GREEN}Ready to install on device!${NC}"
echo "=============================================="
