import { Request, Response } from 'express';
import fs from 'fs';

// OCR.space provides free OCR API (25,000 requests/month free tier)
// Get your free API key at: https://ocr.space/ocrapi/freekey
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || ''; // Must be set in environment
const OCR_SPACE_API_URL = 'https://api.ocr.space/parse/image';

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

/**
 * Recognize VIN from uploaded image using OCR.space API
 */
export async function recognizeVIN(req: MulterRequest, res: Response): Promise<void> {
    try {
        // Check if API key is configured
        if (!OCR_SPACE_API_KEY) {
            console.error('[OCR] OCR_SPACE_API_KEY not configured');
            res.status(503).json({
                success: false,
                error: 'OCR service not configured',
                message: 'Please configure OCR_SPACE_API_KEY environment variable'
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'No image uploaded' });
            return;
        }

        console.log('[OCR] Processing image:', req.file.originalname, 'size:', req.file.size);

        // Read image and convert to base64
        const imagePath = req.file.path;
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        // Determine file type
        let fileType = 'jpg';
        if (req.file.mimetype === 'image/png') fileType = 'png';
        else if (req.file.mimetype === 'image/gif') fileType = 'gif';
        else if (req.file.mimetype === 'image/webp') fileType = 'webp';

        // Use URL-encoded form data (more reliable than FormData with fetch)
        const formBody = new URLSearchParams();
        formBody.append('base64Image', `data:image/${fileType};base64,${base64Image}`);
        formBody.append('language', 'eng');
        formBody.append('isOverlayRequired', 'false');
        formBody.append('detectOrientation', 'true');
        formBody.append('scale', 'true');
        formBody.append('OCREngine', '2');
        formBody.append('filetype', fileType.toUpperCase());

        console.log('[OCR] Calling OCR.space API with filetype:', fileType);

        const response = await fetch(OCR_SPACE_API_URL, {
            method: 'POST',
            headers: {
                'apikey': OCR_SPACE_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formBody.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OCR] OCR.space API error:', errorText);
            res.json({
                success: false,
                message: 'OCR service temporarily unavailable',
                vin: null
            });
            return;
        }

        const data = await response.json() as {
            ParsedResults?: Array<{ ParsedText?: string }>;
            IsErroredOnProcessing?: boolean;
            ErrorMessage?: string;
        };

        if (data.IsErroredOnProcessing || !data.ParsedResults?.[0]?.ParsedText) {
            console.error('[OCR] OCR.space parsing error:', data.ErrorMessage);
            res.json({
                success: false,
                message: data.ErrorMessage || 'Could not parse image',
                vin: null
            });
            return;
        }

        const ocrText = data.ParsedResults[0].ParsedText;
        console.log('[OCR] OCR.space raw text:', ocrText.substring(0, 200));

        // Extract VIN from OCR text
        const vin = extractVINFromText(ocrText);

        if (vin) {
            console.log('[OCR] Extracted VIN:', vin);
            res.json({
                success: true,
                vin: vin,
                confidence: 'high',
                source: 'ocr.space'
            });
        } else {
            // Try to find partial match
            const partial = findPartialVIN(ocrText);
            if (partial) {
                console.log('[OCR] Partial VIN found:', partial);
                res.json({
                    success: true,
                    vin: partial,
                    confidence: 'medium',
                    source: 'ocr.space'
                });
            } else {
                res.json({
                    success: false,
                    message: 'Could not find VIN in image',
                    vin: null
                });
            }
        }

        // Cleanup uploaded file
        try {
            fs.unlinkSync(imagePath);
        } catch (e) {
            console.log('[OCR] Could not cleanup temp file:', imagePath);
        }

    } catch (error) {
        console.error('[OCR] Error:', error);
        res.status(500).json({
            error: 'OCR processing failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Extract VIN from OCR text with corrections
 */
function extractVINFromText(text: string): string | null {
    // Remove all whitespace and special chars
    const compactText = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Strategy 1: Find JN (Nissan) and take 17 chars
    const jnIndex = compactText.indexOf('JN');
    if (jnIndex !== -1 && compactText.length >= jnIndex + 17) {
        const vin = compactText.substring(jnIndex, jnIndex + 17);
        return applyVINCorrections(vin);
    }

    // Strategy 2: Find IN (J often read as I) and correct
    const inMatch = compactText.match(/IN[8B][A-Z0-9]{14}/);
    if (inMatch) {
        const corrected = 'JN' + inMatch[0].substring(2);
        return applyVINCorrections(corrected);
    }

    // Strategy 3: Look for Chassis No. label
    const chassisMatch = text.toUpperCase().match(/CHASSIS\s*N[O0]\.?\s*[:.]?\s*([A-Z0-9]{17})/i);
    if (chassisMatch) {
        return applyVINCorrections(chassisMatch[1]);
    }

    // Strategy 4: Any 17-char VIN pattern starting with known prefixes
    const vinPattern = /[A-HJ-NPR-Z0-9]{17}/g;
    const matches = compactText.match(vinPattern);
    if (matches) {
        for (const m of matches) {
            if (/^[JW12345]/.test(m)) {
                return applyVINCorrections(m);
            }
        }
        return applyVINCorrections(matches[0]);
    }

    return null;
}

/**
 * Apply position-based OCR corrections
 */
function applyVINCorrections(vin: string): string {
    if (!vin || vin.length !== 17) return vin;

    const chars = vin.split('');

    // Position 3: For Nissan (JN), position 3 is typically 1 or 8
    if (chars[0] === 'J' && chars[1] === 'N') {
        if (chars[2] === 'B') chars[2] = '8';
        if (chars[2] === 'I' || chars[2] === 'L') chars[2] = '1';
        if (chars[2] === 'S') chars[2] = '8';
    }

    // Position 6: Usually a number
    if (chars[0] === 'J' && chars[1] === 'N' && /[A-Z]/.test(chars[5])) {
        if (chars[5] === 'I' || chars[5] === 'L' || chars[5] === '1') chars[5] = '2';
        if (chars[5] === 'Z') chars[5] = '2';
        if (chars[5] === 'S') chars[5] = '5';
        if (chars[5] === 'B') chars[5] = '8';
        if (chars[5] === 'O' || chars[5] === 'D' || chars[5] === 'Q') chars[5] = '0';
    }

    // Position 9: Check digit (must be 0-9 or X)
    if (!/[0-9X]/.test(chars[8])) {
        if (chars[8] === 'O' || chars[8] === 'D' || chars[8] === 'Q') chars[8] = '0';
        if (chars[8] === 'I' || chars[8] === 'L') chars[8] = '1';
        if (chars[8] === 'S') chars[8] = '5';
        if (chars[8] === 'B' || chars[8] === 'R') chars[8] = '8';
        if (chars[8] === 'Z') chars[8] = '2';
    }

    // Positions 12-17: Serial number (should be numbers)
    for (let i = 11; i < 17; i++) {
        if (/[A-Z]/.test(chars[i])) {
            if (chars[i] === 'O' || chars[i] === 'D' || chars[i] === 'Q') chars[i] = '0';
            if (chars[i] === 'I' || chars[i] === 'L') chars[i] = '1';
            if (chars[i] === 'S') chars[i] = '5';
            if (chars[i] === 'B') chars[i] = '8';
            if (chars[i] === 'Z') chars[i] = '2';
            if (chars[i] === 'G') chars[i] = '6';
        }
    }

    return chars.join('');
}

/**
 * Find partial VIN for user to correct
 */
function findPartialVIN(text: string): string | null {
    const compactText = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const patterns = [
        /JN[A-Z0-9]{10,15}/,
        /IN[8B][A-Z0-9]{10,14}/,
        /NO[8B][A-Z0-9]{10,14}/
    ];

    for (const pattern of patterns) {
        const match = compactText.match(pattern);
        if (match) {
            let result = match[0];
            if (result.startsWith('IN') || result.startsWith('NO')) {
                result = 'JN' + result.substring(2);
            }
            return applyVINCorrections(result.substring(0, 17).padEnd(17, '0')).replace(/0+$/, '');
        }
    }

    return null;
}

/**
 * Recognize VIN from base64 image (for mobile app)
 * Accepts JSON body with { image: "base64string" }
 */
export async function recognizeVINBase64(req: Request, res: Response): Promise<void> {
    try {
        // Check if API key is configured
        if (!OCR_SPACE_API_KEY) {
            console.error('[OCR] OCR_SPACE_API_KEY not configured');
            res.status(503).json({
                vin: null,
                confidence: 0,
                error: 'OCR service not configured'
            });
            return;
        }

        const { image } = req.body;

        if (!image) {
            res.status(400).json({
                vin: null,
                confidence: 0,
                error: 'No image data provided'
            });
            return;
        }

        console.log('[OCR] Processing base64 image, length:', image.length);

        // Prepare base64 image for OCR.space API
        let base64Image = image;
        // Add data URI prefix if not present
        if (!base64Image.startsWith('data:image')) {
            base64Image = `data:image/jpeg;base64,${base64Image}`;
        }

        // Use URL-encoded form data
        const formBody = new URLSearchParams();
        formBody.append('base64Image', base64Image);
        formBody.append('language', 'eng');
        formBody.append('isOverlayRequired', 'false');
        formBody.append('detectOrientation', 'true');
        formBody.append('scale', 'true');
        formBody.append('OCREngine', '2'); // Engine 2 is better for documents
        formBody.append('filetype', 'JPG');

        console.log('[OCR] Calling OCR.space API for mobile request');

        const response = await fetch(OCR_SPACE_API_URL, {
            method: 'POST',
            headers: {
                'apikey': OCR_SPACE_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formBody.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OCR] OCR.space API error:', errorText);
            res.json({
                vin: null,
                confidence: 0,
                error: 'OCR service error'
            });
            return;
        }

        const data = await response.json() as {
            ParsedResults?: Array<{ ParsedText?: string }>;
            IsErroredOnProcessing?: boolean;
            ErrorMessage?: string;
        };

        if (data.IsErroredOnProcessing || !data.ParsedResults?.[0]?.ParsedText) {
            console.error('[OCR] OCR.space parsing error:', data.ErrorMessage);
            res.json({
                vin: null,
                confidence: 0,
                raw_text: '',
                error: data.ErrorMessage || 'Could not parse image'
            });
            return;
        }

        const ocrText = data.ParsedResults[0].ParsedText;
        console.log('[OCR] Mobile OCR raw text:', ocrText.substring(0, 200));

        // Extract VIN from OCR text
        const vin = extractVINFromText(ocrText);

        if (vin) {
            console.log('[OCR] Mobile extracted VIN:', vin);
            res.json({
                vin: vin,
                confidence: 85,
                raw_text: ocrText.substring(0, 500)
            });
        } else {
            // Try partial match
            const partial = findPartialVIN(ocrText);
            if (partial) {
                console.log('[OCR] Mobile partial VIN:', partial);
                res.json({
                    vin: partial,
                    confidence: 60,
                    raw_text: ocrText.substring(0, 500)
                });
            } else {
                res.json({
                    vin: null,
                    confidence: 0,
                    raw_text: ocrText.substring(0, 500),
                    error: 'VIN not found in image'
                });
            }
        }

    } catch (error) {
        console.error('[OCR] Mobile OCR error:', error);
        res.status(500).json({
            vin: null,
            confidence: 0,
            error: error instanceof Error ? error.message : 'OCR processing failed'
        });
    }
}
