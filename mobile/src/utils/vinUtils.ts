// VIN Validation Utilities
// Implements robust check digit validation and cleaning

const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const TRANSLITERATION: Record<string, number> = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
};

export const isValidVIN = (vin: string): boolean => {
    // 1. Basic format check
    const cleanVin = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanVin.length !== 17) return false;

    // 2. Illegal characters check (I, O, Q are not allowed in VINs)
    if (/[IOQ]/.test(cleanVin)) return false;

    // 3. Check Digit Calculation (North American VINs)
    // Note: Some regions (EU) don't strictly enforce check digit, but we'll try it.
    // If it fails, we might still accept it if format seems valid but warn.
    // However, specifically QScrap user asked for "smart and complex to clean detect all 17".
    // We will trust the check digit for validation feedback.

    let sum = 0;
    for (let i = 0; i < 17; i++) {
        const char = cleanVin[i];
        let value = parseInt(char, 10);

        if (isNaN(value)) {
            value = TRANSLITERATION[char];
        }

        sum += value * VIN_WEIGHTS[i];
    }

    const checkDigitValue = sum % 11;
    const checkDigitChar = checkDigitValue === 10 ? 'X' : checkDigitValue.toString();

    return checkDigitChar === cleanVin[8];
};

export const cleanupVIN = (scannedText: string): string | null => {
    // 1. Remove noise
    let clean = scannedText.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // 2. Fix common OCR errors
    // 0 -> O is handled by "O not allowed", so we swap O to 0 if found? 
    // Actually VIN standard forbids I, O, Q. If OCR sees 'O', it's likely '0'.
    // If OCR sees 'I', it's likely '1'.
    // If OCR sees 'Q', it's likely '0' or '9'? Let's stick to safe swaps.

    clean = clean.replace(/O/g, '0');
    clean = clean.replace(/I/g, '1');
    clean = clean.replace(/Q/g, '0');

    // 3. Search for a 17-char sequence
    // If the text is longer than 17, try to find a valid 17-char substring
    if (clean.length === 17) {
        return isValidVIN(clean) ? clean : clean; // Return anyway if 17 chars, let UI show error if invalid check digit
    }

    if (clean.length > 17) {
        // Sliding window to find valid VIN
        for (let i = 0; i <= clean.length - 17; i++) {
            const potentialVin = clean.substring(i, i + 17);
            if (isValidVIN(potentialVin)) {
                return potentialVin;
            }
        }
    }

    // 4. If almost 17 (16 or 18), maybe return best guess?
    // For now, return the cleaned string if it's close, user can fix.
    if (clean.length >= 17) return clean.substring(0, 17);

    return null;
};
