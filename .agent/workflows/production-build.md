---
description: Complete workflow for building and publishing QScrap mobile app to stores
---
# Production Build Workflow

This workflow builds signed APK (testing) or AAB (Play Store) releases.

## Prerequisites
- JDK 17+ installed: `java -version`
- Android SDK configured
- Latest code committed and pushed

---

## Quick Commands

### Customer App - APK (Testing)
// turbo
```bash
cd /home/user/qscrap.qa/mobile && \
npx expo prebuild --platform android --clean && \
cd android && ./gradlew assembleRelease
```
Output: `mobile/android/app/build/outputs/apk/release/app-release.apk`

### Customer App - AAB (Play Store)
// turbo
```bash
cd /home/user/qscrap.qa/mobile && \
npx expo prebuild --platform android --clean && \
cd android && ./gradlew bundleRelease
```
Output: `mobile/android/app/build/outputs/bundle/release/app-release.aab`

### Driver App - APK (Testing)
// turbo
```bash
cd /home/user/qscrap.qa/driver-mobile && \
npx expo prebuild --platform android --clean && \
cd android && ./gradlew assembleRelease
```
Output: `driver-mobile/android/app/build/outputs/apk/release/app-release.apk`

### Driver App - AAB (Play Store)
// turbo
```bash
cd /home/user/qscrap.qa/driver-mobile && \
npx expo prebuild --platform android --clean && \
cd android && ./gradlew bundleRelease
```
Output: `driver-mobile/android/app/build/outputs/bundle/release/app-release.aab`

---

## Full Clean Build (When cache issues suspected)

### Step 1: Clean ALL Caches
// turbo
```bash
cd /home/user/qscrap.qa/mobile
rm -rf node_modules/.cache android/.gradle android/app/build
rm -rf $TMPDIR/metro-* $TMPDIR/haste-map-*
```

### Step 2: Regenerate Native Code
// turbo
```bash
npx expo prebuild --platform android --clean
```

### Step 3: Build
// turbo
```bash
cd android && ./gradlew bundleRelease  # or assembleRelease for APK
```

---

## Install on Device
```bash
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
```

---

## Keystore Signing

For Play Store, you need a signed release. The keystore is auto-generated in:
`android/app/release.keystore`

If you need custom signing, create `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=*****
MYAPP_RELEASE_KEY_PASSWORD=*****
```

---

## Troubleshooting

### Build fails with Gradle error
```bash
cd android && ./gradlew --stop && ./gradlew clean
```

### Old code appears in APK
```bash
rm -rf android/
npx expo prebuild --platform android --clean
```

### Java version mismatch
```bash
java -version  # Should be 17+
export JAVA_HOME=/path/to/jdk17
```
