/**
 * Document Generation Service
 * Handles invoice generation, PDF creation, QR codes, and digital signatures
 */
import { Pool } from 'pg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { DocumentData, GenerateInvoiceParams, DocumentRecord } from './types';
import { DocumentGenerationError, PDFGenerationError } from './errors';
import logger from '../../utils/logger';
import { BILINGUAL_LABELS, COMPANY_INFO, formatConditionBilingual } from './bilingual-labels';

// Lazy load optional dependencies
let puppeteer: any;
let QRCode: any;

try {
    puppeteer = require('puppeteer');
} catch (e) {
    logger.warn('Puppeteer not available, PDF generation will be limited');
}

try {
    QRCode = require('qrcode');
} catch (e) {
    logger.warn('QRCode not available');
}

export class DocumentGenerationService {
    constructor(private pool: Pool) { }

    /**
     * Generate invoice (customer or garage statement)
     */
    async generateInvoice(params: GenerateInvoiceParams): Promise<{ document: DocumentRecord; message: string }> {
        const { orderId, userId, userType, invoiceType, ipAddress } = params;

        try {
            // Get order details
            const orderResult = await this.pool.query(`
                SELECT 
                    o.*,
                    u.full_name as customer_name,
                    u.phone_number as customer_phone,
                    g.garage_name,
                    gu.phone_number as garage_phone,
                    g.address as garage_address,
                    g.cr_number as garage_cr_number,
                    g.trade_license_number,
                    b.bid_amount,
                    b.part_condition,
                    b.warranty_days,
                    b.notes as bid_notes,
                    r.car_make,
                    r.car_model,
                    r.car_year,
                    r.part_description,
                    r.part_category,
                    r.part_number
                FROM orders o
                JOIN users u ON o.customer_id = u.user_id
                JOIN garages g ON o.garage_id = g.garage_id
                JOIN users gu ON g.garage_id = gu.user_id
                JOIN bids b ON o.bid_id = b.bid_id
                JOIN part_requests r ON b.request_id = r.request_id
                WHERE o.order_id = $1
            `, [orderId]);

            if (orderResult.rows.length === 0) {
                throw new DocumentGenerationError('Order not found');
            }

            const order = orderResult.rows[0];

            // Authorization check
            if (userType === 'customer' && order.customer_id !== userId) {
                throw new DocumentGenerationError('Not authorized');
            }
            if (userType === 'garage' && order.garage_id !== userId) {
                throw new DocumentGenerationError('Not authorized');
            }

            // Check if invoice already exists
            const existingDoc = await this.pool.query(`
                SELECT * FROM documents 
                WHERE order_id = $1 
                  AND document_type = 'invoice'
                  AND document_data->>'invoice_type' = $2
                  AND status != 'voided'
            `, [orderId, invoiceType]);

            if (existingDoc.rows.length > 0) {
                return {
                    document: existingDoc.rows[0],
                    message: `${invoiceType === 'garage' ? 'Garage payout statement' : 'Customer invoice'} already exists`
                };
            }

            // Generate document number and verification code
            const docNumber = await this.generateDocumentNumber('invoice');
            const verifyCode = await this.generateVerificationCode();

            // Build document data
            const documentData = this.buildDocumentData(order, invoiceType, docNumber, verifyCode);

            // Generate QR code
            const qrCodeData = await this.generateQRCode(`https://qscrap.qa/verify/${verifyCode}`);

            // Generate digital signature
            const digitalSignature = this.generateDigitalSignature(docNumber, orderId, invoiceType, order.total_amount);

            // Insert document record
            const insertResult = await this.pool.query(`
                INSERT INTO documents (
                    document_type, document_number, order_id, customer_id, garage_id,
                    document_data, verification_code, verification_url,
                    qr_code_data, digital_signature, signature_timestamp,
                    status, created_by, created_by_type, ip_address
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            `, [
                'invoice', docNumber, orderId, order.customer_id, order.garage_id,
                JSON.stringify(documentData), verifyCode, `https://qscrap.qa/verify/${verifyCode}`,
                qrCodeData, digitalSignature, new Date(),
                'generated', userId, userType, ipAddress
            ]);

            return {
                document: { ...insertResult.rows[0], document_data: documentData },
                message: 'Invoice generated successfully'
            };
        } catch (err) {
            if (err instanceof DocumentGenerationError) {
                throw err;
            }
            throw new DocumentGenerationError((err as Error).message);
        }
    }

    /**
     * Build document data structure
     */
    private buildDocumentData(order: any, invoiceType: string, docNumber: string, verifyCode: string): DocumentData {
        const warrantyDays = order.warranty_days || 30;
        const warrantyExpiry = new Date();
        warrantyExpiry.setDate(warrantyExpiry.getDate() + warrantyDays);

        const partPrice = parseFloat(order.part_price || order.bid_amount);
        const platformFee = parseFloat(order.platform_fee || 0);
        const deliveryFee = parseFloat(order.delivery_fee || 0);
        const totalAmount = parseFloat(order.total_amount);
        const commissionRate = parseFloat(order.commission_rate || 0.15);
        const netPayout = parseFloat(order.garage_payout_amount || (partPrice - platformFee));

        // Use part_category from database, fallback to generic text
        // IMPORTANT: Never show customer's raw part_description in invoice (could be long/messy)
        let displayPartName = 'Car Spare Part';  // Generic fallback
        let category = 'Car Spare Part';
        let subcategory = '';

        if (order.part_category) {
            category = order.part_category;
            displayPartName = order.part_category;
        }

        if (invoiceType === 'garage') {
            // Garage payout statement (B2B)
            return {
                invoice_type: 'garage',
                invoice_number: docNumber,
                invoice_date: new Date().toISOString(),
                order_number: order.order_number,
                labels: BILINGUAL_LABELS,

                garage: {
                    name: order.garage_name,
                    phone: order.garage_phone,
                    address: order.garage_address || 'Qatar',
                    cr_number: order.garage_cr_number || 'N/A',
                    trade_license: order.trade_license_number || null,
                },

                platform: {
                    name: COMPANY_INFO.brand.en,
                    name_ar: COMPANY_INFO.brand.ar,
                },

                customer_ref: {
                    name: order.customer_name,
                    phone: order.customer_phone,
                    order_number: order.order_number,
                },

                item: {
                    vehicle: `${order.car_make} ${order.car_model} ${order.car_year}`,
                    category: category || 'Spare Part',
                    subcategory: subcategory || '',
                    part_name: displayPartName,
                    part_number: order.part_number || 'N/A',
                    condition: formatConditionBilingual(order.part_condition),
                    warranty_days: warrantyDays,
                },

                pricing: {
                    part_price: partPrice,
                    commission_rate: commissionRate,
                    commission_rate_percent: `${Math.round(commissionRate * 100)}%`,
                    platform_fee: platformFee,
                    net_payout: netPayout,
                },

                verification: {
                    code: verifyCode,
                    url: `https://qscrap.qa/verify/${verifyCode}`,
                },

                payment: {
                    method: order.payment_method || 'Cash',
                    status: order.payment_status || 'Completed',
                },

                // Company support info for Qatar commercial compliance
                company: COMPANY_INFO,
            };
        } else {
            // Customer invoice (B2C)
            // CRITICAL: Must include loyalty discount for Qatar Ministry of Commerce compliance
            const loyaltyDiscount = parseFloat(order.loyalty_discount || 0);
            const loyaltyDiscountPercent = loyaltyDiscount > 0 && partPrice > 0
                ? Math.round((loyaltyDiscount / (totalAmount + loyaltyDiscount)) * 100)
                : 0;

            return {
                invoice_type: 'customer',
                invoice_number: docNumber,
                invoice_date: new Date().toISOString(),
                order_number: order.order_number,
                labels: BILINGUAL_LABELS,

                seller: {
                    name: order.garage_name,
                    phone: order.garage_phone,
                    address: order.garage_address || 'Qatar',
                    cr_number: order.garage_cr_number || 'N/A',
                    trade_license: order.trade_license_number || null,
                },

                buyer: {
                    name: order.customer_name,
                    phone: order.customer_phone,
                    address: order.delivery_address || 'N/A',
                },

                item: {
                    vehicle: `${order.car_make} ${order.car_model} ${order.car_year}`,
                    category: category || 'Spare Part',
                    subcategory: subcategory || '',
                    part_name: displayPartName,
                    part_number: order.part_number || 'N/A',
                    condition: formatConditionBilingual(order.part_condition),
                    warranty_days: warrantyDays,
                    warranty_expiry: warrantyExpiry.toISOString(),
                },

                pricing: {
                    part_price: partPrice,
                    delivery_fee: deliveryFee,
                    loyalty_discount: loyaltyDiscount, // CRITICAL for legal compliance
                    loyalty_discount_percent: loyaltyDiscountPercent > 0 ? loyaltyDiscountPercent : undefined,
                    vat_rate: 0,
                    vat_amount: 0,
                    total: totalAmount,
                },

                verification: {
                    code: verifyCode,
                    url: `https://qscrap.qa/verify/${verifyCode}`,
                },

                payment: {
                    method: order.payment_method || 'Cash',
                    status: order.payment_status || 'Paid',
                },

                // Company support info for Qatar commercial compliance
                company: COMPANY_INFO,
            };
        }
    }

    /**
     * Generate PDF from HTML (uses Puppeteer if available)
     */
    async generatePDF(html: string): Promise<Buffer> {
        if (!puppeteer) {
            logger.warn('Puppeteer not available, returning HTML');
            return Buffer.from(html, 'utf-8');
        }

        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
            });

            await browser.close();
            return Buffer.from(pdfBuffer);
        } catch (err) {
            logger.error('PDF generation error', { error: err });
            throw new PDFGenerationError((err as Error).message);
        }
    }

    /**
     * Generate QR code
     */
    async generateQRCode(url: string): Promise<string> {
        if (!QRCode) {
            return '';
        }

        try {
            return await QRCode.toDataURL(url, { width: 150, margin: 1 });
        } catch (err) {
            logger.error('QR code generation error', { error: err });
            return '';
        }
    }

    /**
     * Generate digital signature (SHA256)
     */
    generateDigitalSignature(docNumber: string, orderId: string, invoiceType: string, totalAmount: number): string {
        const signatureData = `${docNumber}|${orderId}|${invoiceType}|${totalAmount}|${new Date().toISOString()}`;
        return crypto.createHash('sha256').update(signatureData).digest('hex');
    }

    /**
     * Generate document number using database function
     */
    private async generateDocumentNumber(type: string): Promise<string> {
        const result = await this.pool.query(
            `SELECT generate_document_number($1) as doc_number`,
            [type]
        );
        return result.rows[0].doc_number;
    }

    /**
     * Generate verification code using database function
     */
    private async generateVerificationCode(): Promise<string> {
        const result = await this.pool.query(
            `SELECT generate_verification_code() as verify_code`
        );
        return result.rows[0].verify_code;
    }

    /**
     * Get logo as base64 (helper for PDF generation)
     */
    getLogoBase64(): string {
        try {
            // Try multiple possible paths (local dev and Docker)
            const possiblePaths = [
                path.join(process.cwd(), 'public/assets/images/qscrap-logo.png'),
                path.join(__dirname, '../../../public/assets/images/qscrap-logo.png'),
                '/app/public/assets/images/qscrap-logo.png'
            ];

            for (const logoPath of possiblePaths) {
                if (fs.existsSync(logoPath)) {
                    const logoBuffer = fs.readFileSync(logoPath);
                    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
                }
            }
            logger.warn('Logo not found at any expected path');
        } catch (err) {
            logger.error('Error reading logo file', { error: err });
        }
        return '';
    }
}
