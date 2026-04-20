import { useRef, useEffect } from 'react';

/**
 * Hook to get the previous value of a variable.
 * Useful for comparing current and previous values.
 * 
 * @example
 * const [count, setCount] = useState(0);
 * const prevCount = usePrevious(count);
 * 
 * useEffect(() => {
 *   if (prevCount !== undefined && count > prevCount) {
 *     console.log('Count increased!');
 *   }
 * }, [count, prevCount]);
 */
export const usePrevious = <T>(value: T): T | undefined => {
    const ref = useRef<T | undefined>(undefined);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref.current;
};

export default usePrevious;
