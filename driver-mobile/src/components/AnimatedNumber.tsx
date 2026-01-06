import React, { useState, useEffect, useRef } from 'react';
import { Text, TextStyle, Animated, Easing } from 'react-native';
import { FontSize } from '../constants/theme';

interface AnimatedNumberProps {
    value: number;
    delay?: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    style?: TextStyle;
    formatOptions?: Intl.NumberFormatOptions;
}

/**
 * Premium animated count-up number component.
 * Smoothly animates from 0 to target value with easing.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
    value,
    delay = 0,
    duration = 1000,
    prefix = '',
    suffix = '',
    style,
    formatOptions,
}) => {
    const [displayValue, setDisplayValue] = useState(0);
    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
        const timeout = setTimeout(() => {
            const animate = (timestamp: number) => {
                if (!startTimeRef.current) {
                    startTimeRef.current = timestamp;
                }

                const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

                // Ease out cubic for smooth deceleration
                const eased = 1 - Math.pow(1 - progress, 3);

                setDisplayValue(Math.floor(eased * value));

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate);
                } else {
                    setDisplayValue(value); // Ensure final value is exact
                }
            };

            animationRef.current = requestAnimationFrame(animate);
        }, delay);

        return () => {
            clearTimeout(timeout);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            startTimeRef.current = null;
        };
    }, [value, delay, duration]);

    const formattedValue = formatOptions
        ? new Intl.NumberFormat('en-US', formatOptions).format(displayValue)
        : displayValue.toString();

    return (
        <Text style={[styles.defaultStyle, style]}>
            {prefix}{formattedValue}{suffix}
        </Text>
    );
};

/**
 * Animated currency display with QAR suffix
 */
export const AnimatedCurrency: React.FC<Omit<AnimatedNumberProps, 'suffix'>> = (props) => {
    return <AnimatedNumber {...props} suffix=" QAR" />;
};

/**
 * Animated rating display with star
 */
export const AnimatedRating: React.FC<{ value: number; delay?: number; style?: TextStyle }> = ({
    value,
    delay = 0,
    style,
}) => {
    const [displayValue, setDisplayValue] = useState(0);
    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
        const timeout = setTimeout(() => {
            const animate = (timestamp: number) => {
                if (!startTimeRef.current) {
                    startTimeRef.current = timestamp;
                }

                const progress = Math.min((timestamp - startTimeRef.current) / 1000, 1);
                const eased = 1 - Math.pow(1 - progress, 3);

                setDisplayValue(eased * value);

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate);
                } else {
                    setDisplayValue(value);
                }
            };

            animationRef.current = requestAnimationFrame(animate);
        }, delay);

        return () => {
            clearTimeout(timeout);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            startTimeRef.current = null;
        };
    }, [value, delay]);

    return (
        <Text style={[styles.defaultStyle, style]}>
            {displayValue.toFixed(1)}
        </Text>
    );
};

const styles = {
    defaultStyle: {
        fontSize: FontSize.xl,
        fontWeight: '700' as const,
    },
};

export default AnimatedNumber;
