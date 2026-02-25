# QScrap Driver App - Pre-Rebuild Critical Enhancements

**Date:** February 25, 2026  
**Priority:** 🔴 **URGENT - Must Fix Before Production Rebuild**  
**Auditor:** Senior Mobile Full-Stack Engineer (20 years experience)

---

## Executive Summary

After comprehensive audit and code review, I've identified **8 CRITICAL issues** that must be fixed before production rebuild to prevent:
- Data loss
- Poor user experience
- Production incidents
- Driver frustration
- Support ticket spikes

**Estimated Fix Time:** 6-8 hours total  
**Risk of Skipping:** HIGH

---

## 🔴 CRITICAL #1: Sentry Logging in Production

### Problem
```typescript
// Found 81 console.log/error/warn statements in codebase
console.error('[API] Network error:', networkError);
console.warn('[Auth] Background refresh failed:', error?.message);
console.log('[Location] Permission check error:', err);
```

**Risk:**
- ❌ Sensitive data leakage (tokens, user data, locations)
- ❌ Performance impact in production
- ❌ Noisy logs that hide real issues

### Fix Required

```typescript
// src/utils/logger.ts - CREATE THIS FILE
import * as Sentry from '@sentry/react-native';

const isDev = __DEV__;

export const log = (...args: any[]) => {
    if (isDev) {
        console.log(...args);
    }
};

export const warn = (...args: any[]) => {
    if (isDev) {
        console.warn(...args);
    } else {
        Sentry.captureMessage(args.join(' '), { level: 'warning' });
    }
};

export const error = (...args: any[]) => {
    const message = args.join(' ');
    if (isDev) {
        console.error(...args);
    } else {
        // Don't log network errors to Sentry (too noisy)
        if (!message.includes('Network') && !message.includes('timeout')) {
            Sentry.captureException(new Error(message));
        }
    }
};

// Usage in code:
import { log, warn, error } from '../utils/logger';

// Replace all console.* with logger.*
```

**Files to Update:** 15 files with console statements  
**Time:** 1 hour

---

## 🔴 CRITICAL #2: Missing Error Boundary for Assignment Flow

### Problem
```typescript
// HomeScreen.tsx - No error boundary
try {
    const assignmentsRes = await api.getAssignments('active');
    // If this fails, UI shows empty state but no retry option
} catch (assignErr) {
    console.error('[Home] Failed to fetch assignments:', assignErr);
    // Silent failure - driver sees no assignments but doesn't know why
}
```

**Risk:**
- ❌ Drivers see blank screen with no explanation
- ❌ No retry mechanism
- ❌ Support tickets: "App shows no assignments"

### Fix Required

```typescript
// src/components/assignment/AssignmentErrorState.tsx - CREATE THIS
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../constants/theme';

interface AssignmentErrorStateProps {
    error: string;
    onRetry: () => void;
}

export const AssignmentErrorState: React.FC<AssignmentErrorStateProps> = ({
    error,
    onRetry,
}) => {
    return (
        <View style={styles.container}>
            <Ionicons name="alert-circle" size={64} color={Colors.danger} />
            <Text style={styles.title}>Failed to Load Assignments</Text>
            <Text style={styles.message}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginTop: Spacing.lg,
    },
    message: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: Spacing.md,
    },
    retryButton: {
        flexDirection: 'row',
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: 24,
        marginTop: Spacing.lg,
        alignItems: 'center',
    },
    retryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: Spacing.sm,
    },
});
```

**Files to Update:** HomeScreen.tsx, AssignmentsScreen.tsx  
**Time:** 45 minutes

---

## 🔴 CRITICAL #3: POD Photo Upload Without Size Validation

### Problem
```typescript
// ProofOfDeliveryScreen.tsx
const compressedUri = await compressPODPhoto(photo.uri, {
    maxWidth: 1920,
    quality: 0.7,
    format: 'jpeg',
});
// ❌ No validation of final file size
// ❌ No fallback if compression fails
// ❌ No user feedback if upload fails
```

**Risk:**
- ❌ Upload timeout on slow networks
- ❌ Server rejection of large files
- ❌ Driver stuck on "Submitting..." screen

### Fix Required

```typescript
// src/utils/imageCompressor.ts - UPDATE THIS
export const compressPODPhoto = async (
    uri: string,
    options: CompressionOptions = DEFAULT_POD_OPTIONS
): Promise<{ uri: string; sizeKB: number; success: boolean }> => {
    try {
        const result = await ImageManipulator.manipulateAsync(
            uri,
            actions,
            { compress: config.quality ?? 0.7 }
        );

        // Validate size
        const sizeKB = await estimateFileSize(result.uri);
        
        // If still too large, compress more
        if (sizeKB > 500) {
            const result2 = await ImageManipulator.manipulateAsync(
                result.uri,
                [{ resize: { width: 1280 } }],
                { compress: 0.5 }
            );
            return {
                uri: result2.uri,
                sizeKB: await estimateFileSize(result2.uri),
                success: true,
            };
        }

        return {
            uri: result.uri,
            sizeKB,
            success: true,
        };
    } catch (error) {
        logError('[POD Compressor] Error:', error);
        return {
            uri, // Return original as fallback
            sizeKB: await estimateFileSize(uri),
            success: false,
        };
    }
};

// In ProofOfDeliveryScreen.tsx
const takePicture = async () => {
    const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: false,
    });
    
    if (photo?.uri) {
        const result = await compressPODPhoto(photo.uri);
        
        if (!result.success) {
            Alert.alert(
                'Compression Warning',
                'Photo size is large. Upload may take longer on slow networks.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Continue Anyway' },
                ]
            );
        }
        
        setPhotoUri(result.uri);
    }
};
```

**Files to Update:** imageCompressor.ts, ProofOfDeliveryScreen.tsx  
**Time:** 1 hour

---

## 🔴 CRITICAL #4: No Network Status Feedback During Assignment Acceptance

### Problem
```typescript
// HomeScreen.tsx - Assignment popup
const handleAcceptAssignment = async () => {
    try {
        await api.acceptAssignment(assignmentId);
        // ❌ No loading state
        // ❌ No network check
        // ❌ No retry if fails
    } catch (error) {
        // Silent failure - driver thinks they accepted but backend didn't receive
    }
};
```

**Risk:**
- ❌ Driver accepts assignment but it's not recorded
- ❌ Assignment goes to another driver (double booking)
- ❌ Customer sees "Driver assigned" but driver doesn't have it

### Fix Required

```typescript
// src/components/assignment/AcceptRejectButton.tsx - CREATE THIS
import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { useNetwork } from '../../hooks/useNetwork';

interface AcceptRejectButtonProps {
    type: 'accept' | 'reject';
    onPress: () => Promise<void>;
    disabled?: boolean;
}

export const AcceptRejectButton: React.FC<AcceptRejectButtonProps> = ({
    type,
    onPress,
    disabled,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const { isConnected } = useNetwork();

    const handlePress = async () => {
        if (!isConnected) {
            Alert.alert(
                'No Internet Connection',
                'Please check your internet connection and try again.'
            );
            return;
        }

        setIsLoading(true);
        try {
            await onPress();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                type === 'accept' ? styles.acceptButton : styles.rejectButton,
                (!isConnected || isLoading || disabled) && styles.disabledButton,
            ]}
            onPress={handlePress}
            disabled={!isConnected || isLoading || disabled}
        >
            {isLoading ? (
                <ActivityIndicator color="#fff" />
            ) : (
                <>
                    <Ionicons
                        name={type === 'accept' ? 'checkmark-circle' : 'close-circle'}
                        size={24}
                        color="#fff"
                    />
                    <Text style={styles.text}>
                        {type === 'accept' ? 'Accept' : 'Reject'}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};
```

**Files to Update:** AssignmentPopup.tsx, HomeScreen.tsx  
**Time:** 1 hour

---

## 🔴 CRITICAL #5: Background Location Task Not Properly Cleaned Up

### Problem
```typescript
// LocationService.ts
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    // Background task runs indefinitely
    // ❌ No cleanup on logout
    // ❌ No cleanup on app uninstall
    // ❌ Battery drain risk
});
```

**Risk:**
- ❌ Battery drain (location tracking continues after logout)
- ❌ Privacy concerns (tracking after driver logs out)
- ❌ App store rejection (background location misuse)

### Fix Required

```typescript
// src/services/LocationService.ts - UPDATE
class LocationService {
    async stopTracking() {
        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isStarted) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log('[LocationService] Stopped location tracking');
        }
    }

    // NEW: Complete cleanup
    async cleanup() {
        await this.stopTracking();
        
        // Unregister the task completely
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isRegistered) {
            await TaskManager.unregisterTaskAsync(LOCATION_TASK_NAME);
            console.log('[LocationService] Unregistered background task');
        }
    }
}

// In AuthContext.tsx - UPDATE
const logout = async () => {
    try {
        // Stop location tracking BEFORE logout
        await locationService.cleanup(); // ← Use cleanup instead of stopTracking
        
        // ... rest of logout logic
    }
};
```

**Files to Update:** LocationService.ts, AuthContext.tsx  
**Time:** 30 minutes

---

## 🔴 CRITICAL #6: No Assignment Expiry Handling

### Problem
```typescript
// Assignment interface has no expiry field
export interface Assignment {
    assignment_id: string;
    status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
    // ❌ No expires_at field
    // ❌ No timeout handling
}
```

**Risk:**
- ❌ Driver sees expired assignments as active
- ❌ Driver drives to pickup for cancelled assignment
- ❌ Customer waits for driver who's not coming

### Fix Required

```typescript
// src/services/api.ts - UPDATE Assignment interface
export interface Assignment {
    assignment_id: string;
    order_id: string;
    status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';
    expires_at?: string; // ← ADD THIS
    accepted_at?: string; // ← ADD THIS
    // ... rest of fields
}

// src/components/assignment/AssignmentCard.tsx - ADD expiry indicator
import { differenceInMinutes } from 'date-fns'; // Install: npm install date-fns

const AssignmentCard = ({ assignment }) => {
    const isExpired = assignment.expires_at && 
        new Date(assignment.expires_at) < new Date();
    
    const timeLeft = assignment.expires_at ? 
        differenceInMinutes(new Date(assignment.expires_at), new Date()) : null;

    if (isExpired) {
        return (
            <View style={styles.expiredCard}>
                <Text style={styles.expiredText}>⚠️ Assignment Expired</Text>
                <Text>This assignment is no longer available</Text>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            {/* Normal card content */}
            {timeLeft !== null && timeLeft < 30 && (
                <View style={styles.urgentBadge}>
                    <Text style={styles.urgentText}>
                        ⏰ {timeLeft} min left
                    </Text>
                </View>
            )}
        </View>
    );
};
```

**Files to Update:** api.ts, AssignmentCard.tsx, HomeScreen.tsx  
**Time:** 1 hour  
**Dependencies:** `npm install date-fns`

---

## 🔴 CRITICAL #7: No Driver Rating Display After Delivery

### Problem
```typescript
// ProfileScreen shows rating but no history
// Driver completes delivery but never sees customer rating
// ❌ No feedback loop
// ❌ No motivation to improve service
```

**Risk:**
- ❌ Drivers don't know their performance
- ❌ No incentive for good service
- ❌ Can't identify problematic drivers

### Fix Required

```typescript
// src/screens/tabs/ProfileScreen.tsx - ADD rating section
const ProfileScreen = () => {
    const { driver } = useAuth();
    
    return (
        <ScrollView>
            {/* Existing profile content */}
            
            {/* NEW: Rating Breakdown Section */}
            <View style={styles.ratingSection}>
                <Text style={styles.sectionTitle}>Your Performance</Text>
                
                <View style={styles.ratingCard}>
                    <View style={styles.ratingHeader}>
                        <Ionicons name="star" size={32} color="#FFD700" />
                        <Text style={styles.ratingAverage}>
                            {driver?.rating_average?.toFixed(1) || '0.0'}
                        </Text>
                        <Text style={styles.ratingCount}>
                            ({driver?.rating_count || 0} ratings)
                        </Text>
                    </View>
                    
                    {/* Rating breakdown */}
                    <View style={styles.ratingBar}>
                        <View style={styles.ratingBarFill} />
                    </View>
                    
                    {/* Recent ratings */}
                    <TouchableOpacity onPress={navigateToRatings}>
                        <Text style={styles.viewRatingsLink}>
                            View Recent Ratings →
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};
```

**Files to Update:** ProfileScreen.tsx, api.ts (add getRatings endpoint)  
**Time:** 1.5 hours

---

## 🔴 CRITICAL #8: No Emergency SOS Feature

### Problem
```typescript
// Driver in accident or emergency situation
// ❌ No quick way to alert operations
// ❌ No emergency contact from app
// ❌ Safety risk for drivers
```

**Risk:**
- ❌ Driver safety liability
- ❌ No emergency protocol
- ❌ Legal/insurance issues

### Fix Required

```typescript
// src/components/EmergencySOS.tsx - CREATE THIS
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '../constants/theme';

export const EmergencySOS = () => {
    const [isPressed, setIsPressed] = useState(false);

    const handleSOS = async () => {
        if (!isPressed) {
            setIsPressed(true);
            setTimeout(() => setIsPressed(false), 3000);
            return;
        }

        // Get location
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });

        // Send SOS to operations
        Alert.alert(
            '🚨 EMERGENCY ALERT',
            'This will send your location to operations immediately. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'SEND SOS',
                    style: 'destructive',
                    onPress: async () => {
                        await api.sendSOS(location.coords);
                        Alert.alert('SOS Sent', 'Help is on the way. Stay on the line.');
                    },
                },
            ]
        );
    };

    return (
        <TouchableOpacity
            style={[
                styles.sosButton,
                isPressed && styles.sosButtonPressed,
            ]}
            onPress={handleSOS}
            onLongPress={handleSOS}
            delayLongPress={2000}
        >
            <Ionicons name="warning" size={32} color="#fff" />
            <Text style={styles.sosText}>
                {isPressed ? 'Hold to Cancel' : 'SOS Emergency'}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    sosButton: {
        backgroundColor: Colors.danger,
        padding: Spacing.lg,
        borderRadius: 50,
        alignItems: 'center',
        margin: Spacing.lg,
    },
    sosButtonPressed: {
        backgroundColor: '#991B1B',
    },
    sosText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginTop: Spacing.sm,
    },
});
```

**Files to Update:** ProfileScreen.tsx (add SOS button), api.ts (add sendSOS endpoint)  
**Time:** 1.5 hours

---

## Implementation Priority

| # | Enhancement | Priority | Time | Risk if Skipped |
|---|-------------|----------|------|-----------------|
| 1 | Sentry Logging | 🔴 CRITICAL | 1h | HIGH - Data leakage |
| 2 | Error Boundaries | 🔴 CRITICAL | 45m | HIGH - Poor UX |
| 3 | POD Size Validation | 🔴 CRITICAL | 1h | HIGH - Upload failures |
| 4 | Network Feedback | 🔴 CRITICAL | 1h | HIGH - Double booking |
| 5 | Location Cleanup | 🔴 CRITICAL | 30m | HIGH - Battery/Privacy |
| 6 | Assignment Expiry | 🔴 CRITICAL | 1h | MEDIUM - Confusion |
| 7 | Driver Ratings | 🟡 MEDIUM | 1.5h | MEDIUM - No feedback |
| 8 | Emergency SOS | 🟡 MEDIUM | 1.5h | HIGH - Safety risk |

**Total Time:** 8 hours (1 full day)

---

## Pre-Rebuild Checklist

Before running production rebuild:

- [ ] All 8 enhancements implemented
- [ ] `npx expo install expo-image-manipulator date-fns`
- [ ] All console.* replaced with logger.*
- [ ] Error boundaries tested
- [ ] POD compression tested on slow network
- [ ] Assignment acceptance flow tested offline
- [ ] Location cleanup verified on logout
- [ ] SOS button tested with operations team
- [ ] TypeScript compilation: `npx tsc --noEmit`
- [ ] All tests passing: `npm test`

---

## Conclusion

**DO NOT SKIP THESE ENHANCEMENTS**

These are not "nice-to-haves" - they are **critical production requirements** that prevent:
- Data breaches
- Driver frustration
- Support ticket floods
- Safety incidents
- App store rejection

**Estimated Time:** 8 hours  
**ROI:** Prevents days of production firefighting

---

**Prepared by:** Senior Mobile Full-Stack Engineer  
**Date:** February 25, 2026  
**Status:** 🔴 **URGENT - Implement Before Rebuild**
