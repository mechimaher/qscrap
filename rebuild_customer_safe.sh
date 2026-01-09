#!/bin/bash
set -e
echo "🚀 Starting Safe Customer App Rebuild..."

cd mobile

# 1. Install Dependencies
echo "[1/4] Installing dependencies..."
npm install

# 2. Prebuild (Clean native folders)
echo "[2/4] Exo Prebuild (Clean)..."
npx expo prebuild --clean --platform android

# 2.5. Fix Manifest Package Name (for Autolinking)
echo "[2.5/4] Patching AndroidManifest.xml..."
sed -i 's/<manifest/<manifest package="qa.qscrap.app"/' android/app/src/main/AndroidManifest.xml

# 3. Build APK
echo "[3/4] Gradle Build..."
# Clean autolinking cache just in case
rm -rf android/build android/app/build
cd android
chmod +x gradlew
./gradlew assembleRelease

# 4. Copy Output
echo "[4/4] Copying APK..."
cd ../..
TIMESTAMP=$(date +%Y%m%d_%H%M)
cp mobile/android/app/build/outputs/apk/release/app-release.apk "QScrap_HOTFIX_${TIMESTAMP}.apk"

echo "✅ Build Complete: QScrap_HOTFIX_${TIMESTAMP}.apk"
