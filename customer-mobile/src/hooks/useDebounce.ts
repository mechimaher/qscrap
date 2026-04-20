import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to debounce a value.
 * Useful for search inputs and form fields.
 * 
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounce(search, 300);
 * 
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     performSearch(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 */
export const useDebounce = <T>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

/**
 * Hook to create a debounced callback function.
 * Useful for event handlers that shouldn't fire too frequently.
 * 
 * @example
 * const handleSearch = useDebouncedCallback((query: string) => {
 *   api.search(query);
 * }, 300);
 */
export const useDebouncedCallback = <T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): T => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef<T>(callback);

    // Update callback ref when callback changes
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    ) as T;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return debouncedCallback;
};

export default useDebounce;
