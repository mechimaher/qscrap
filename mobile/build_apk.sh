#!/bin/bash
# ================================================================
# QScrap Customer App — Enterprise Clean APK Build Script
# One-click: clears ALL caches, installs deps, builds fresh APK
# ================================================================
set -e

# ---- Environment Setup ----
export ANDROID_HOME=/home/user/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
ulimit -n 65536 2>/dev/null || true

# Navigate to mobile dir if run from repo root
if [ -d "mobile" ]; then cd mobile; fi

echo ""
echo "=============================================="
echo "  QScrap Customer APK — Clean Build"
echo "=============================================="
echo "Directory : $(pwd)"
echo "Time      : $(date)"
echo "Node      : $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "Java      : $(java -version 2>&1 | head -1)"
echo "=============================================="
echo ""

# ---- Step 1: Nuke ALL Caches ----
echo "🧹 [1/7] Clearing ALL caches..."
rm -rf .expo/ android/ ios/ 2>/dev/null || true
rm -rf /tmp/metro-* /tmp/expo-* /tmp/haste-* 2>/dev/null || true
rm -rf /tmp/react-native-* 2>/dev/null || true
rm -rf $HOME/.gradle/caches/transforms-* 2>/dev/null || true
rm -rf $HOME/.gradle/daemon 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true
echo "   ✓ Caches cleared"

# ---- Step 2: Install ALL Dependencies ----
echo ""
echo "📦 [2/7] Installing dependencies (fresh)..."
rm -rf node_modules package-lock.json 2>/dev/null || true
npm install --legacy-peer-deps
echo "   ✓ Dependencies installed"

# ---- Step 3: Expo Prebuild ----
echo ""
echo "📱 [3/7] Running Expo Prebuild (generates Android project)..."
npx expo prebuild --platform android --clean
echo "   ✓ Android project generated"

# ---- Step 4: Configure Gradle Memory ----
echo ""
echo "🔧 [4/7] Configuring Gradle for optimal build..."
mkdir -p android
GRADLE_PROPS="android/gradle.properties"
if [ -f "$GRADLE_PROPS" ]; then
    # Remove existing jvmargs line and add optimized one
    sed -i '/org.gradle.jvmargs/d' "$GRADLE_PROPS"
fi
echo "" >> "$GRADLE_PROPS"
echo "# Enterprise build optimization" >> "$GRADLE_PROPS"
echo "org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=2048m" >> "$GRADLE_PROPS"
echo "   ✓ Gradle memory configured (8GB heap)"

# ---- Step 5: Setup Build Temp Directory ----
echo ""
echo "📂 [5/7] Setting up build environment..."
mkdir -p android/temp_build
export GRADLE_OPTS="-Djava.io.tmpdir=$(pwd)/android/temp_build -Dorg.gradle.vfs.watch=false"
echo "   ✓ Build environment ready"

# ---- Step 6: Build APK ----
echo ""
echo "🔨 [6/7] Building Release APK (this takes 5-15 minutes)..."
echo "   (Using: no-daemon, no-cache, controlled parallelism)"
cd android || { echo "❌ android/ directory not found!"; exit 1; }

./gradlew assembleRelease \
    --console=plain \
    --no-daemon \
    --no-build-cache \
    -Dorg.gradle.parallel=false \
    -Dorg.gradle.workers.max=2

BUILD_RESULT=$?
cd ..

# ---- Step 7: Verify & Copy APK ----
echo ""
echo "=============================================="
if [ $BUILD_RESULT -eq 0 ]; then
    APK_SOURCE="android/app/build/outputs/apk/release/app-release.apk"
    if [ -f "$APK_SOURCE" ]; then
        cp "$APK_SOURCE" "../QScrapCustomer.apk"
        APK_SIZE=$(ls -lh "../QScrapCustomer.apk" | awk '{print $5}')
        echo "✅ [7/7] BUILD SUCCESS!"
        echo ""
        echo "   APK Location : ../QScrapCustomer.apk"
        echo "   APK Size     : $APK_SIZE"
        echo "   Built at     : $(date)"
        echo ""
        echo "   Ready to install on device!"
    else
        echo "⚠️  Gradle succeeded but APK file not found at:"
        echo "   $APK_SOURCE"
        echo ""
        echo "   Searching for APK..."
        find android/ -name "*.apk" 2>/dev/null
        exit 1
    fi
else
    echo "❌ BUILD FAILED (exit code: $BUILD_RESULT)"
    echo ""
    echo "   Check the build output above for errors."
    echo "   Common fixes:"
    echo "   - Run: rm -rf android/ && npx expo prebuild --platform android --clean"
    echo "   - Check JAVA_HOME: $JAVA_HOME"
    echo "   - Check ANDROID_HOME: $ANDROID_HOME"
    exit 1
fi
echo "=============================================="
