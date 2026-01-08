#!/bin/bash
set -e
echo "🚀 Starting Safe Driver App Rebuild..."

cd driver-mobile

# 1. Install Dependencies
echo "[1/4] Installing dependencies..."
npm install

# 2. Prebuild (Clean native folders to link AsyncStorage)
echo "[2/4] Exo Prebuild (Clean)..."
npx expo prebuild --clean --platform android

# 3. Build APK
echo "[3/4] Gradle Build..."
cd android
chmod +x gradlew
./gradlew assembleRelease

# 4. Copy Output
echo "[4/4] Copying APK..."
cd ../..
TIMESTAMP=$(date +%Y%m%d_%H%M)
cp driver-mobile/android/app/build/outputs/apk/release/app-release.apk "QScrapDriver_HOTFIX_${TIMESTAMP}.apk"

echo "✅ Build Complete: QScrapDriver_HOTFIX_${TIMESTAMP}.apk"
