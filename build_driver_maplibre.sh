#!/bin/bash
# QScrap Driver App - Build with Package Name Fix
# Fixes the autolinking package name issue (com.qscrapdriver -> com.qscrap.driver)

set -e

echo "🚀 Starting Driver App Build (MapLibre Edition)..."

cd /home/user/qscrap.qa/driver-mobile

# Step 1: Clean prebuild
echo "[1/4] Running Expo Prebuild..."
npx expo prebuild --clean --platform android <<< "y"

# Step 2: Fix the autolinking package name in generated files
echo "[2/4] Patching autolinking package name..."
find android -name "*.java" -exec sed -i 's/com\.qscrapdriver/com.qscrap.driver/g' {} \;
find android -name "*.json" -exec sed -i 's/com\.qscrapdriver/com.qscrap.driver/g' {} \;

# Verify the patch
if grep -r "com.qscrapdriver" android/; then
    echo "⚠️ Warning: Some occurrences of com.qscrapdriver may still exist"
else
    echo "✅ Package name patched successfully"
fi

# Step 3: Build
echo "[3/4] Running Gradle Build..."
cd android
./gradlew assembleRelease --no-daemon

# Step 4: Copy APK
echo "[4/4] Copying APK..."
APK_NAME="QScrapDriver_MapLibre_$(date +%Y%m%d_%H%M).apk"
cp app/build/outputs/apk/release/app-release.apk /home/user/qscrap.qa/$APK_NAME

echo "✅ Build Complete: $APK_NAME"
