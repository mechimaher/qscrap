# Google Maps API Setup Guide for QScrap

## Overview
Google Maps API is now integrated into the QScrap mobile app for:
- Interactive maps in TrackingScreen and DeliveryTrackingScreen
- Geocoding (converting coordinates to addresses)
- Distance calculations for delivery fees
- Location search and autocomplete

## Step 1: Get Your API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Click "Create Credentials" → "API Key"
4. Copy the generated key

## Step 2: Enable Required APIs

In Google Cloud Console, enable these APIs for your project:
- **Maps SDK for Android**
- **Maps SDK for iOS**
- **Geocoding API**
- **Directions API**
- **Distance Matrix API** (for delivery fee calculations)

## Step 3: Restrict Your API Key (Security)

**IMPORTANT:** Never use an unrestricted API key in production!

### iOS Restrictions:
1. Under "Application restrictions", select "iOS apps"
2. Add your Bundle ID: `qa.qscrap.app`

### Android Restrictions:
1. Under "Application restrictions", select "Android apps"
2. Add your Package name: `qa.qscrap.app`
3. Add your SHA-1 signing certificate fingerprint:
   - For debug builds: Run `cd android && ./gradlew signingReport`
   - For production: Use your upload keystore SHA-1

### API Restrictions:
1. Under "API restrictions", select "Restrict key"
2. Select only these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Geocoding API
   - Directions API
   - Distance Matrix API

## Step 4: Configure Environment Variables

1. Copy the example file:
   ```bash
   cd /workspace/mobile
   cp .env.example .env
   ```

2. Edit `.env` and add your API key:
   ```
   GOOGLE_MAPS_API_KEY=AIzaSy...your_actual_key_here
   ```

3. For production builds, also set this in your CI/CD environment or EAS Build secrets.

## Step 5: Rebuild the App

After adding the API key, rebuild your app:

```bash
# Development
npx expo run:android
npx expo run:ios

# Production with EAS
eas build --profile production
```

## Step 6: Verify Installation

1. Open the app and navigate to any screen with a map (e.g., Track Order)
2. You should see the map load without "API Key Missing" errors
3. Check logs for any Google Maps-related errors

## Troubleshooting

### Map shows "For development purposes only"
- Your API key is working but may have restrictions that block production
- Check that your Bundle ID/Package name matches exactly

### Map is blank or gray
- Verify APIs are enabled in Google Cloud Console
- Check that API key is correctly set in `.env`
- Ensure you have billing enabled on your Google Cloud project

### "API Key not found" error
- Rebuild the app after changing `.env`
- Environment variables are baked in at build time

## Cost Management

Google Maps offers $200 free credit monthly (enough for ~28,000 map loads).

To monitor usage:
1. Go to Google Cloud Console → Billing
2. Set up budget alerts at $50, $100, $150
3. Review usage reports monthly

## Qatar-Specific Optimization

For best results in Qatar:
- Use `region=qa` parameter in API calls (already configured)
- Consider enabling Arabic language support (`language=ar`) for Arabic app mode
- Test maps in industrial areas (Mesaieed) and northern regions (Al Khor) for coverage

## Support

For issues, contact:
- Google Maps Platform Support: https://developers.google.com/maps/support
- Internal team: Check #mobile-dev Slack channel
