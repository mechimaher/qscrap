// Animated Number Component - Premium Count-Up Effect
import React, { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    style?: TextStyle;
    suffix?: string;
    prefix?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    duration = 1000,
    style,
    suffix = '',
    prefix = '',
}) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrame: number;

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);

            // Easing function for smooth deceleration
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(value * easeOutQuart);

            setDisplayValue(currentValue);

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setDisplayValue(value); // Ensure final value is exact
            }
        };

        animationFrame = requestAnimationFrame(animate);

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [value, duration]);

    return (
        <Text style={style}>
            {prefix}{displayValue.toLocaleString()}{suffix}
        </Text>
    );
};

export default AnimatedNumber;
