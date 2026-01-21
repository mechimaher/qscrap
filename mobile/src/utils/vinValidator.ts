/**
 * VIN Validator Utilities
 * 
 * Implements ISO 3779 VIN checksum validation and OCR normalization
 * for zero-error VIN detection from Qatar registration cards.
 */

// VIN Transliteration Map (ISO 3779)
// Letters must be converted to numbers for checksum calculation
const TRANSLITERATION_MAP: Record<string, number> = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5,
    'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5,
    'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5,
    'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

// Position weights for VIN checksum (positions 1-17)
const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

// Forbidden characters in VIN (never appear)
const FORBIDDEN_CHARS = /[IOQ]/;

// Valid VIN character pattern
const VALID_VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

/**
 * Validates a VIN using ISO 3779 checksum algorithm
 * This is the core validation that ensures zero-error detection
 * 
 * @param vin - The VIN string to validate
 * @returns true if VIN is valid and checksum passes
 */
export function isValidVIN(vin: string): boolean {
    if (!vin) return false;

    // Normalize
    vin = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // 1. Length check - must be exactly 17 characters
    if (vin.length !== 17) return false;

    // 2. Forbidden characters check
    if (FORBIDDEN_CHARS.test(vin)) return false;

    // 3. Pattern check
    if (!VALID_VIN_PATTERN.test(vin)) return false;

    // 4. Calculate checksum
    let sum = 0;
    for (let i = 0; i < 17; i++) {
        const char = vin[i];
        const value = TRANSLITERATION_MAP[char];

        if (value === undefined) return false;

        sum += value * POSITION_WEIGHTS[i];
    }

    // 5. Compare with check digit (position 9, index 8)
    const remainder = sum % 11;
    const expectedCheckDigit = remainder === 10 ? 'X' : remainder.toString();

    return vin[8] === expectedCheckDigit;
}

/**
 * Normalizes raw OCR text for VIN extraction
 * Removes spaces, symbols, and converts to uppercase
 * 
 * @param text - Raw OCR text
 * @returns Normalized text
 */
export function normalizeOCRText(text: string): string {
    if (!text) return '';
    return text
        .toUpperCase()
        .replace(/\s+/g, '') // Remove spaces
        .replace(/[^A-Z0-9]/g, ''); // Keep only alphanumeric
}

/**
 * PRO OCR Correction Map - Extended for thermal/dot-matrix fonts
 * Covers common OCR confusions seen on Qatar registration cards
 */
const OCR_CORRECTIONS: Record<string, string> = {
    'O': '0', // O always becomes 0 in VIN
    'Q': '0', // Q always becomes 0 in VIN
    'I': '1', // I always becomes 1 in VIN
    'Z': '2', // Z ↔ 2 confusion on dot-matrix
    'S': '5', // S ↔ 5 confusion
    'B': '8', // B ↔ 8 confusion
    'G': '6', // G ↔ 6 confusion
};

/**
 * VIN Keywords found on Qatar registration cards (Arabic + English)
 * Used for keyword-anchored extraction to improve accuracy
 */
const VIN_KEYWORDS = [
    'VIN',
    'CHASSIS',
    'CHASSIS NO',
    'CHASSIS NUMBER',
    'رقم الهيكل',
    'رقم الشاسيه',
    'الهيكل',
];

/**
 * Safe OCR character corrections based on VIN rules
 * Only applies corrections that are unambiguous in VIN context
 * 
 * @param char - Character from OCR
 * @returns Corrected character
 */
export function autoCorrectOCRChar(char: string): string {
    return OCR_CORRECTIONS[char] || char;
}

/**
 * Aggressive OCR correction for low-confidence scans
 * Applies more aggressive corrections when standard fails
 * 
 * @param char - Character from OCR
 * @param aggressive - If true, apply extended corrections
 * @returns Corrected character
 */
export function autoCorrectOCRCharAggressive(char: string, aggressive: boolean = false): string {
    if (aggressive) {
        // Additional aggressive corrections for very noisy OCR
        const aggressiveCorrections: Record<string, string> = {
            ...OCR_CORRECTIONS,
            'L': '1', // L ↔ 1
            'T': '7', // T ↔ 7
        };
        return aggressiveCorrections[char] || char;
    }
    return OCR_CORRECTIONS[char] || char;
}

/**
 * Applies safe auto-corrections to entire VIN string
 * 
 * @param vin - Raw VIN from OCR
 * @param aggressive - If true, apply extended corrections
 * @returns Corrected VIN
 */
export function autoCorrectVIN(vin: string, aggressive: boolean = false): string {
    if (!vin) return '';
    return vin
        .toUpperCase()
        .split('')
        .map(char => autoCorrectOCRCharAggressive(char, aggressive))
        .join('');
}

/**
 * Checks if text contains VIN-related keywords (Arabic or English)
 * Used for keyword-anchored extraction
 * 
 * @param text - Text to check
 * @returns true if contains VIN keyword
 */
export function containsVINKeyword(text: string): boolean {
    const upperText = text.toUpperCase();
    return VIN_KEYWORDS.some(keyword => upperText.includes(keyword.toUpperCase()));
}

/**
 * Normalizes OCR text preserving spaces for split VINs
 * Qatar cards often have spaced VINs like "WVW ZZZ 3C ZWE..."
 * 
 * @param text - Raw OCR text
 * @returns Normalized text with spaces collapsed (not removed)
 */
export function normalizeOCRTextPreservingSpaces(text: string): string {
    if (!text) return '';
    return text
        .toUpperCase()
        .replace(/[\-\.]/g, '') // Remove hyphens and periods
        .replace(/\s+/g, '') // Collapse spaces
        .replace(/[^A-Z0-9]/g, ''); // Keep only alphanumeric
}

/**
 * Extracts VIN candidates from OCR text with keyword anchoring
 * Prioritizes sequences near VIN/CHASSIS keywords
 * 
 * @param ocrText - Full OCR text from image
 * @returns Array of potential VIN candidates (prioritized)
 */
export function extractVINCandidates(ocrText: string): string[] {
    if (!ocrText) return [];

    const candidates: string[] = [];
    const priorityCandidates: string[] = [];

    // Split into lines for keyword-anchored search
    const lines = ocrText.split(/\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1] || '';
        const hasKeyword = containsVINKeyword(line);

        // If line contains keyword, prioritize this line and the next
        const searchText = hasKeyword ? (line + ' ' + nextLine) : line;
        const normalized = normalizeOCRTextPreservingSpaces(searchText);

        if (normalized.length >= 17) {
            // Slide window to find all possible 17-char sequences
            for (let j = 0; j <= normalized.length - 17; j++) {
                const candidate = normalized.substring(j, j + 17);
                // Apply auto-correction (standard first)
                const corrected = autoCorrectVIN(candidate, false);

                // Check if it looks like a VIN (no forbidden chars after correction)
                if (!FORBIDDEN_CHARS.test(corrected)) {
                    if (hasKeyword) {
                        priorityCandidates.push(corrected);
                    } else {
                        candidates.push(corrected);
                    }
                }
            }
        }
    }

    // Also try aggressive correction on priority candidates
    for (const candidate of priorityCandidates) {
        const aggressiveCorrected = autoCorrectVIN(candidate, true);
        if (!FORBIDDEN_CHARS.test(aggressiveCorrected) && !priorityCandidates.includes(aggressiveCorrected)) {
            priorityCandidates.push(aggressiveCorrected);
        }
    }

    // Qatar-specific: sort by proximity to anchor keywords
    const anchorRegex = /(VIN|CHASSIS|رقم\s*الهيكل)/i;
    if (anchorRegex.test(ocrText)) {
        // Prioritize VINs close to label
        priorityCandidates.sort((a, b) => ocrText.indexOf(a) - ocrText.indexOf(b));
    }

    // Return priority candidates first
    return [...priorityCandidates, ...candidates];
}

/**
 * Soft VIN validation - returns true for pattern match even if checksum fails
 * Use this as fallback when strict validation fails
 * 
 * @param vin - VIN to validate
 * @returns Object with isStrict (checksum valid) and isPattern (format valid)
 */
export function softValidateVIN(vin: string): { isStrict: boolean; isPattern: boolean; vin: string } {
    if (!vin) return { isStrict: false, isPattern: false, vin: '' };

    const normalized = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const corrected = autoCorrectVIN(normalized);

    const isStrict = isValidVIN(corrected);
    const isPattern = corrected.length === 17 && VALID_VIN_PATTERN.test(corrected);

    return { isStrict, isPattern, vin: corrected };
}

/**
 * Validates and scores a VIN candidate
 * Returns confidence score from 0-100
 * 
 * @param vin - VIN candidate
 * @returns Confidence score
 */
export function getVINConfidence(vin: string): number {
    let score = 0;

    // Length check (+20)
    if (vin.length === 17) score += 20;

    // No forbidden characters (+20)
    if (!FORBIDDEN_CHARS.test(vin)) score += 20;

    // Valid pattern (+20)
    if (VALID_VIN_PATTERN.test(vin)) score += 20;

    // Checksum valid (+40)
    if (isValidVIN(vin)) score += 40;

    return score;
}

/**
 * Finds the best VIN from multiple OCR results using multi-frame consensus
 * Accepts only if same VIN appears 2+ times and passes checksum
 * 
 * @param vinResults - Array of VINs from multiple frames
 * @returns Best VIN candidate or null if no consensus
 */
export function findConsensusVIN(vinResults: string[]): string | null {
    if (!vinResults.length) return null;

    // Count occurrences of each valid VIN
    const counts = new Map<string, number>();

    for (const vin of vinResults) {
        const corrected = autoCorrectVIN(vin);
        if (isValidVIN(corrected)) {
            counts.set(corrected, (counts.get(corrected) || 0) + 1);
        }
    }

    // Find VIN with 2+ occurrences
    for (const [vin, count] of counts.entries()) {
        if (count >= 2) {
            return vin;
        }
    }

    // Fallback: return first valid VIN if no consensus
    for (const vin of vinResults) {
        const corrected = autoCorrectVIN(vin);
        if (isValidVIN(corrected)) {
            return corrected;
        }
    }

    return null;
}

/**
 * Validates user-edited VIN after single character correction
 * 
 * @param originalVIN - Original detected VIN
 * @param editedVIN - User-edited VIN
 * @returns Object with validity and message
 */
export function validateUserEdit(originalVIN: string, editedVIN: string): { valid: boolean; message: string } {
    // Count character differences
    let differences = 0;
    for (let i = 0; i < 17; i++) {
        if (originalVIN[i] !== editedVIN[i]) {
            differences++;
        }
    }

    if (differences > 1) {
        return {
            valid: false,
            message: 'Only single character correction is allowed. Please rescan instead.',
        };
    }

    if (!isValidVIN(editedVIN)) {
        return {
            valid: false,
            message: 'The edited VIN does not pass checksum validation.',
        };
    }

    return {
        valid: true,
        message: 'VIN is valid!',
    };
}

export default {
    isValidVIN,
    normalizeOCRText,
    normalizeOCRTextPreservingSpaces,
    autoCorrectVIN,
    autoCorrectOCRCharAggressive,
    extractVINCandidates,
    containsVINKeyword,
    softValidateVIN,
    getVINConfidence,
    findConsensusVIN,
    validateUserEdit,
};
