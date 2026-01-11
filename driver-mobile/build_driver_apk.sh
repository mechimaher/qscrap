#!/bin/bash
# QScrap Driver App - Production APK Build Script
# Builds a release APK with proper versioning

export ANDROID_HOME=/home/rambo/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$ANDROID_HOME/platform-tools:$PATH

# Navigate to driver-mobile directory if script is run from root
if [ -d "driver-mobile" ]; then
    cd driver-mobile
fi

echo "=============================================="
echo "  QScrap Driver APK Build (Offline/Local)"
echo "=============================================="
echo "Working Directory: $(pwd)"
echo "Build Time: $(date)"
echo ""

# Check API URL is production
API_FILE="src/config/api.ts"
if grep -q "192.168" "$API_FILE" 2>/dev/null; then
    echo "⚠️  WARNING: Development API URL detected!"
    echo "   Please update $API_FILE to use production URL"
    echo ""
    echo ""
fi

# Ensure dependencies are installed
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ] || [ ! -d "node_modules/@react-native-community/netinfo" ]; then
    echo "⬇️  Installing dependencies..."
    npm install
else
    echo "✓ Dependencies appear to be installed"
fi
echo ""

# Get version from app.json
VERSION=$(grep -o '"version": *"[^"]*"' app.json | cut -d'"' -f4 || echo "1.0.0")
echo "📦 App Version: $VERSION"
echo ""

# Ensure android directory exists via Prebuild
if [ ! -d "android" ]; then
    echo "📱 Android directory missing. Running Expo Prebuild..."
    npx expo prebuild --platform android --clean
else
    echo "✓ Android directory exists. Proceeding with Gradle..."
fi

cd android || exit 1

echo ""
echo "🧹 Cleaning previous builds..."
./gradlew clean

echo ""
echo "🔨 Running Gradle assembleRelease..."
./gradlew assembleRelease --console=plain

BUILD_RESULT=$?
echo ""
echo "=============================================="

if [ $BUILD_RESULT -eq 0 ]; then
    APK_PATH="./app/build/outputs/apk/release/app-release.apk"
    TIMESTAMP=$(date +%Y%m%d_%H%M)
    DEST_NAME="QScrapDriver_v${VERSION}_${TIMESTAMP}.apk"
    DEST_PATH="../../$DEST_NAME"
    
    if [ -f "$APK_PATH" ]; then
        echo "✅ SUCCESS! Driver APK created."
        cp "$APK_PATH" "$DEST_PATH"
        echo ""
        echo "📦 APK Details:"
        ls -lh "$DEST_PATH"
        echo ""
        echo "📍 Location: $DEST_PATH"
        
        # Also copy as standard name for easy access
        cp "$APK_PATH" "../../QScrapDriver.apk"
        echo "📍 Also copied to: ../../QScrapDriver.apk"
    else
        echo "❌ APK not found at expected location: $APK_PATH"
        echo "   Searching for APK files..."
        find . -name "*.apk" -type f
    fi
else
    echo "❌ BUILD FAILED!"
    echo "   Check the output above for errors."
    exit 1
fi

echo ""
echo "=============================================="
echo "  Build Complete"
echo "=============================================="

