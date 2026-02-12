/**
 * Toast utility for QScrap
 * Simple toast-like notifications using React Native Alert
 * VVIP 2026 - Can be upgraded to a proper toast library later
 */

import { Alert } from 'react-native';

export const toast = {
    success: (title: string, message?: string) => {
        Alert.alert(title, message);
    },
    error: (title: string, message?: string) => {
        Alert.alert(title, message);
    },
    warning: (title: string, message?: string) => {
        Alert.alert(title, message);
    },
    info: (title: string, message?: string) => {
        Alert.alert(title, message);
    },
};

export default toast;
