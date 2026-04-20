import { useState, useEffect } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

interface UseKeyboardReturn {
    isKeyboardVisible: boolean;
    keyboardHeight: number;
}

/**
 * Hook to monitor keyboard visibility and height.
 * Useful for adjusting layouts when keyboard appears.
 * 
 * @example
 * const { isKeyboardVisible, keyboardHeight } = useKeyboard();
 * 
 * return (
 *   <View style={{ paddingBottom: isKeyboardVisible ? keyboardHeight : 0 }}>
 *     <TextInput />
 *   </View>
 * );
 */
export const useKeyboard = (): UseKeyboardReturn => {
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const handleKeyboardShow = (event: KeyboardEvent) => {
            setIsKeyboardVisible(true);
            setKeyboardHeight(event.endCoordinates.height);
        };

        const handleKeyboardHide = () => {
            setIsKeyboardVisible(false);
            setKeyboardHeight(0);
        };

        const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
        const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    return {
        isKeyboardVisible,
        keyboardHeight,
    };
};

/**
 * Dismiss keyboard programmatically
 */
export const dismissKeyboard = () => {
    Keyboard.dismiss();
};

export default useKeyboard;
