---
description: Complete workflow for building a fresh, cache-free customer APK
---
# Clean APK Build Workflow

This workflow ensures a completely fresh APK build with no cached code.

## Prerequisites
- Ensure all changes are committed and pushed to GitHub
- Android Studio or JDK 17+ installed

## Step 1: Verify Latest Code is Committed
```bash
cd /home/user/qscrap.qa
git status
git log -1 --oneline
```
Confirm the latest commit contains your changes.

## Step 2: Clean ALL Caches
// turbo
```bash
cd /home/user/qscrap.qa/mobile

# Clean npm cache
rm -rf node_modules/.cache

# Clean Metro bundler cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*

# Clean Expo cache
npx expo start --clear --no-dev &
sleep 5
kill %1 2>/dev/null || true

# Clean Android build cache
cd android
./gradlew clean
cd ..
```

## Step 3: Clean node_modules and Reinstall (optional but thorough)
```bash
cd /home/user/qscrap.qa/mobile
rm -rf node_modules
npm install
```

## Step 4: Prebuild Android (Regenerate Native Code)
// turbo
```bash
cd /home/user/qscrap.qa/mobile
npx expo prebuild --platform android --clean
```
This regenerates the entire `android/` folder from `app.json`.

## Step 5: Build Fresh APK
// turbo
```bash
cd /home/user/qscrap.qa/mobile/android
./gradlew assembleRelease
```

## Step 6: Locate and Verify APK
// turbo
```bash
ls -la /home/user/qscrap.qa/mobile/android/app/build/outputs/apk/release/
```

The APK will be at:
`mobile/android/app/build/outputs/apk/release/app-release.apk`

## Step 7: Install on Device
```bash
adb install -r /home/user/qscrap.qa/mobile/android/app/build/outputs/apk/release/app-release.apk
```

---

## Quick One-Liner (Full Clean Build)
```bash
cd /home/user/qscrap.qa/mobile && rm -rf node_modules/.cache android/.gradle android/app/build && npx expo prebuild --platform android --clean && cd android && ./gradlew assembleRelease
```

---

## Troubleshooting

### If you see old code in the APK:
1. Delete `android/` folder completely: `rm -rf android/`
2. Re-run `npx expo prebuild --platform android --clean`
3. Build again

### If build fails:
1. Check Java version: `java -version` (should be 17+)
2. Check Gradle version compatibility
3. Run `./gradlew --stop` to kill Gradle daemons
