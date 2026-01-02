#!/bin/bash
export ANDROID_HOME=/home/user/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$ANDROID_HOME/platform-tools:$PATH

# Navigate to the android directory relative to this script
cd "$(dirname "$0")/android" || exit 1

echo "=== Starting APK Build ==="
echo "ANDROID_HOME: $ANDROID_HOME"
echo "JAVA_HOME: $JAVA_HOME"
echo "Working Directory: $(pwd)"
echo ""

# Run Gradle build
./gradlew assembleRelease --console=plain

BUILD_RESULT=$?

echo ""
echo "=== Build Result: $BUILD_RESULT ==="

if [ $BUILD_RESULT -eq 0 ]; then
    APK_PATH="./app/build/outputs/apk/release/app-release.apk"
    DEST_PATH="../../QScrap.apk"
    
    if [ -f "$APK_PATH" ]; then
        echo "SUCCESS! APK created at: $APK_PATH"
        cp "$APK_PATH" "$DEST_PATH"
        echo "Copied to: $DEST_PATH"
        ls -lh "$DEST_PATH"
    else
        echo "APK not found at expected location: $APK_PATH"
        find . -name "*.apk" -type f
    fi
else
    echo "BUILD FAILED!"
    exit 1
fi
