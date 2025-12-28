#!/bin/bash
export ANDROID_HOME=/home/rambo/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$ANDROID_HOME/platform-tools:$PATH

cd /home/rambo/Desktop/QScrap/mobile/android

echo "=== Starting APK Build ==="
echo "ANDROID_HOME: $ANDROID_HOME"
echo "JAVA_HOME: $JAVA_HOME"
echo ""

./gradlew assembleRelease --console=plain

BUILD_RESULT=$?

echo ""
echo "=== Build Result: $BUILD_RESULT ==="

if [ $BUILD_RESULT -eq 0 ]; then
    APK_PATH="/home/rambo/Desktop/QScrap/mobile/android/app/build/outputs/apk/release/app-release.apk"
    if [ -f "$APK_PATH" ]; then
        echo "SUCCESS! APK created at: $APK_PATH"
        cp "$APK_PATH" /home/rambo/Desktop/QScrap.apk
        echo "Copied to: /home/rambo/Desktop/QScrap.apk"
        ls -lh /home/rambo/Desktop/QScrap.apk
    else
        echo "APK not found at expected location"
        find /home/rambo/Desktop/QScrap/mobile/android -name "*.apk" -type f 2>/dev/null
    fi
else
    echo "BUILD FAILED!"
fi
