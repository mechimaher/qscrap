#!/bin/bash
# QScrap Customer App - Production APK Build Script
# "Simple & Efficient" - Includes Dependencies Install + Build

export ANDROID_HOME=/home/user/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$ANDROID_HOME/platform-tools:$PATH

# Increase File Descriptors (Vital for React Native Multidex)
ulimit -n 65536 2>/dev/null

if [ -d "mobile" ]; then
    cd mobile
fi

echo "=============================================="
echo "  QScrap Customer APK Build (Clean Start)"
echo "=============================================="
echo "Working Directory: $(pwd)"
echo "Build Time: $(date)"
echo ""

# 1. Install Dependencies (Fast)
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node Modules..."
    npm install --legacy-peer-deps
else
    echo "✓ Node Modules present"
fi

# 2. Prebuild (Generates Android Project)
echo "📱 Running Expo Prebuild (Clean)..."
npx expo prebuild --platform android --clean

# 3. Configure Gradle Memory
echo "🔧 Configuring Gradle Memory..."
mkdir -p android
if ! grep -q "org.gradle.jvmargs" "android/gradle.properties" 2>/dev/null; then
     echo "org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=2048m" >> "android/gradle.properties"
else
     sed -i 's/org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=2048m/' "android/gradle.properties"
fi

# 4. Local Temp Directory (Fixes I/O Errors)
mkdir -p android/temp_build
export GRADLE_OPTS="-Djava.io.tmpdir=$(pwd)/android/temp_build -Dorg.gradle.vfs.watch=false"

# 5. Build
cd android || exit 1
echo "🔨 Building APK..."
./gradlew assembleRelease \
    --console=plain \
    --no-daemon \
    --no-build-cache \
    -Dorg.gradle.parallel=false \
    -Dorg.gradle.workers.max=2

BUILD_RESULT=$?
cd ..

echo "=============================================="
if [ $BUILD_RESULT -eq 0 ]; then
    APK_SOURCE="android/app/build/outputs/apk/release/app-release.apk"
    if [ -f "$APK_SOURCE" ]; then
        cp "$APK_SOURCE" "../QScrapCustomer.apk"
        echo "✅ SUCCESS! APK: ../QScrapCustomer.apk"
    else
        echo "❌ Build passed but APK not found."
    fi
else
    echo "❌ BUILD FAILED."
    exit 1
fi
