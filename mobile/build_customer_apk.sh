#!/bin/bash
set -e

echo "📦 Installing Dependencies..."
npm install

echo "📱 Running Expo Prebuild..."
npx expo prebuild --platform android --clean

echo "🔧 Configuring Gradle Memory..."
# Append or update org.gradle.jvmargs
if [ -f "android/gradle.properties" ]; then
    if ! grep -q "org.gradle.jvmargs" android/gradle.properties; then
        echo "" >> android/gradle.properties
        echo "org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g" >> android/gradle.properties
    else
        # Use sed to replace lines starting with org.gradle.jvmargs
        sed -i 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g/' android/gradle.properties
    fi
    echo "Updated android/gradle.properties"
else
    echo "⚠️ android/gradle.properties not found!"
fi

echo "🔨 Building Release APK..."
cd android
./gradlew assembleRelease --console=plain

APK_PATH="app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    echo "✅ Success!"
    cp "$APK_PATH" "../../QScrapCustomer.apk"
    echo "Copied to ../../QScrapCustomer.apk"
    ls -lh "../../QScrapCustomer.apk"
else
    echo "❌ APK not found!"
    exit 1
fi
