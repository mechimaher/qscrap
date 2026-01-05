# Prompt for AI Developer

**Role:** Expert Full Stack Developer (Node.js/Express + React Native/Expo)

**Objective:** Implement a robust, end-to-end image compression system for the QScrap application to optimize storage and bandwidth. The goal is to reduce image sizes to approximately 20-50KB without significant visual degradation.

**Context:**
- **Project:** QScrap (Local scrap parts marketplace).
- **Backend:** Node.js, Express, TypeScript. Uses `multer` for file uploads.
- **Mobile:** React Native, Expo, TypeScript. Uses `expo-image-picker`.
- **Current State:** Images are currently uploaded as-is (often 2-5MB+), causing slow uploads and wasted storage.

**Requirements:**

### 1. Backend (Node.js/Express)
- **Library:** Use `sharp` for image processing.
- **Middleware:** Create or update `src/middleware/file.middleware.ts`.
- **Logic:**
    - Accept image uploads via `multer` (memory storage).
    - Process each image buffer using `sharp`.
    - **Resize:** Max dimensions 1200x1200px (maintain aspect ratio, `inside` fit).
    - **Format:** Convert to `WebP`.
    - **Quality:** Set quality to ~80% (or adjust to hit 20-50KB target).
    - **Metadata:** Strip all metadata (EXIF, etc.) to save space.
    - **Output:** Save the processed file to disk (`uploads/` directory) with a unique filename and `.webp` extension.
    - **Response:** Update the `req.files` or `req.file` object with the new path, filename, size, and mimetype so downstream controllers work transparently.
- **Logging:** Log the original size vs. compressed size and the savings percentage for debugging.

### 2. Mobile App (React Native/Expo)
- **Library:** Use `expo-image-manipulator` (already available in Expo).
- **Locations:**
    - `mobile/src/screens/NewRequestScreen.tsx`
    - `mobile/src/screens/DisputeScreen.tsx`
    - `mobile/src/screens/EditProfileScreen.tsx`
- **Logic:**
    - Create a reusable helper function `compressImage(uri: string)` (e.g., in `mobile/src/utils/helpers.ts` or similar) to avoid code duplication.
    - **Resize:** Max width 1024px.
    - **Compression:** JPEG quality 0.7 (70%).
    - **Usage:** Call this helper immediately after `ImagePicker` returns a result in all screens.
    - **Upload:** Ensure the *compressed* URI is used for the upload.
- **UX:** Show a loading indicator during compression if noticeable.


**Files Provided for Context:**

**1. `package.json` (Dependencies)**
```json
{
    "dependencies": {
        "express": "^4.18.2",
        "multer": "^1.4.5-lts.1",
        "sharp": "^0.34.5",
        "typescript": "^5.0.4"
        // ... other deps
    }
}
```

**2. `src/middleware/file.middleware.ts` (Current Structure)**
```typescript
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// TODO: Implement memory storage and sharp compression here
```

**3. `mobile/src/screens/NewRequestScreen.tsx` (Mobile Logic)**
```typescript
// ... imports
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// ... component logic
    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.8,
        });
        // TODO: Add compression logic here before setting state
    };
// ...
```

**4. `mobile/src/screens/DisputeScreen.tsx` (Dispute Evidence)**
```typescript
// ...
    const pickImage = async () => {
        // ...
        const result = await ImagePicker.launchImageLibraryAsync({
            // ...
            quality: 0.8,
        });
        // TODO: Compress here
    };
// ...
```

**5. `mobile/src/screens/EditProfileScreen.tsx` (Avatar)**
```typescript
// ...
    const handleChangePhoto = () => {
        // ...
        // Note: Check if the avatar is actually being uploaded in handleSaveProfile. 
        // If not, please fix that too or at least compress the URI for display/future upload.
        const result = await ImagePicker.launchCameraAsync({
            // ...
            quality: 0.8,
        });
        // TODO: Compress here
    };
// ...
```

**Deliverables:**
1.  Complete code for `src/middleware/file.middleware.ts` implementing the `compressImages` middleware.
2.  Reusable `compressImage` helper function (e.g., in `mobile/src/utils/helpers.ts`).
3.  Updated code snippets for:
    - `NewRequestScreen.tsx`
    - `DisputeScreen.tsx`
    - `EditProfileScreen.tsx`
    showing how to integrate the compression helper.
4.  Instructions on any new dependencies needed.

**Tone:** Professional, production-ready, clean code with comments explaining the "Why".
