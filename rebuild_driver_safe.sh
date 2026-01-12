#!/bin/bash
set -e
echo "🚀 Starting Safe Driver App Rebuild..."

cd driver-mobile

# 1. Install Dependencies
echo "[1/4] Installing dependencies..."
npm install

# 2. Prebuild (Clean native folders to link AsyncStorage)
echo "[2/4] Exo Prebuild (Clean)..."
yes | npx expo prebuild --clean --platform android --no-install

# 2.5. Fix Manifest Package Name (for Autolinking)
echo "[2.5/4] Patching AndroidManifest.xml..."
sed -i 's/<manifest/<manifest package="com.qscrap.driver"/' android/app/src/main/AndroidManifest.xml

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
