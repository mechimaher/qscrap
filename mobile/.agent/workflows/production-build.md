---
description: Complete workflow for building and publishing QScrap mobile app to stores
---

# QScrap Mobile Production Build Workflow

## Prerequisites

### 1. Install Required Tools
```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login

# Link project to EAS
cd mobile
eas init
```

### 2. Configure Push Notifications

#### Firebase (Android)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create project "QScrap"
3. Add Android app with package `qa.qscrap.app`
4. Download `google-services.json` → place in `mobile/`
5. In Firebase > Cloud Messaging, get Server Key

#### Apple Push (iOS)
1. Apple Developer Portal > Certificates > Push Notifications
2. Create APNs Auth Key (.p8 file)
3. Save Key ID and Team ID

---

## Build Commands

### Development Build (Testing Push Notifications)
```bash
# // turbo
eas build --profile development --platform android

# // turbo
eas build --profile development --platform ios
```

### Preview Build (Internal Testing APK)
```bash
# // turbo
eas build --profile preview --platform android
```

### Production Build (Store Submission)

#### Android AAB for Play Store
```bash
# // turbo
eas build --profile production --platform android
```

#### iOS for App Store
```bash
# // turbo  
eas build --profile production --platform ios
```

---

## Store Submission

### Google Play Store

1. **Create Service Account**
   - Google Play Console > API access > Create Service Account
   - Download JSON key → `mobile/credentials/google-play-service-account.json`
   - Grant "Release Manager" permissions

2. **Submit**
```bash
# // turbo
eas submit --platform android
```

### Apple App Store

1. **App Store Connect Setup**
   - Create app with Bundle ID `qa.qscrap.app`
   - Get ASC App ID (numeric ID)
   - Update `eas.json` with actual App ID and Team ID

2. **Submit**
```bash
# // turbo
eas submit --platform ios
```

---

## Environment Variables

Set these in EAS dashboard or eas.json:

| Variable | Development | Preview | Production |
|----------|-------------|---------|------------|
| `EXPO_PUBLIC_API_URL` | localhost:3000 | staging.qscrap.qa | api.qscrap.qa |
| `EXPO_PUBLIC_SOCKET_URL` | localhost:3000 | staging.qscrap.qa | api.qscrap.qa |

---

## OTA Updates

Push updates without rebuilding:
```bash
# // turbo
eas update --branch production --message "Bug fix"
```

---

## Build Checklist Before Submission

- [ ] Update version in `app.json` (`version` + `versionCode`)
- [ ] Test push notifications work
- [ ] Verify API URLs are production
- [ ] Add `google-services.json` for Android
- [ ] Configure iOS push certificates
- [ ] Test on real devices
- [ ] Screenshots ready for stores
- [ ] Privacy policy URL configured
