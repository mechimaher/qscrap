import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';
import pool from '../config/db';
import { getErrorMessage, DocumentData } from '../types';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Import puppeteer for PDF generation
let puppeteer: unknown;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.warn('Puppeteer not available, PDF generation will be limited');
}

// Import QRCode generator
let QRCode: unknown;
try {
    QRCode = require('qrcode');
} catch (e) {
    console.warn('QRCode not available');
}

// ============================================
// BILINGUAL LABELS (ENGLISH / ARABIC)
// Qatar Ministry of Commerce Compliance
// ============================================

type InvoiceType = 'customer' | 'garage';

const BILINGUAL_LABELS = {
    // Document Titles
    customer_invoice_title: { en: 'TAX INVOICE', ar: 'فاتورة ضريبية' },
    garage_invoice_title: { en: 'PAYOUT STATEMENT', ar: 'كشف حساب الورشة' },

    // Section Headers
    seller: { en: 'Seller', ar: 'البائع' },
    buyer: { en: 'Buyer', ar: 'المشتري' },
    platform: { en: 'Platform', ar: 'المنصة' },
    order_number: { en: 'Order Number', ar: 'رقم الطلب' },
    invoice_date: { en: 'Invoice Date', ar: 'تاريخ الفاتورة' },
    statement_date: { en: 'Statement Date', ar: 'تاريخ الكشف' },
    item_details: { en: 'Item Details', ar: 'تفاصيل القطعة' },

    // Table Headers
    item: { en: 'Item', ar: 'القطعة' },
    condition: { en: 'Condition', ar: 'الحالة' },
    warranty: { en: 'Warranty', ar: 'الضمان' },
    amount: { en: 'Amount', ar: 'المبلغ' },

    // Pricing (Customer)
    subtotal: { en: 'Subtotal', ar: 'المجموع الفرعي' },
    delivery_fee: { en: 'Delivery Fee', ar: 'رسوم التوصيل' },
    total: { en: 'Total', ar: 'المجموع الكلي' },
    total_paid: { en: 'Total Paid', ar: 'إجمالي المدفوع' },

    // Pricing (Garage)
    part_price: { en: 'Part Price', ar: 'سعر القطعة' },
    platform_fee: { en: 'Platform Fee', ar: 'رسوم المنصة' },
    commission: { en: 'Commission', ar: 'العمولة' },
    net_payout: { en: 'Net Payout', ar: 'صافي المستحقات' },
    your_earnings: { en: 'Your Earnings', ar: 'أرباحك' },

    // Conditions
    condition_new: { en: 'New', ar: 'جديد' },
    condition_used_excellent: { en: 'Used - Excellent', ar: 'مستعمل - ممتاز' },
    condition_used_good: { en: 'Used - Good', ar: 'مستعمل - جيد' },
    condition_used_fair: { en: 'Used - Fair', ar: 'مستعمل - مقبول' },
    condition_refurbished: { en: 'Refurbished', ar: 'مجدد' },

    // Other
    days: { en: 'Days', ar: 'أيام' },
    warranty_info: { en: 'Warranty Information', ar: 'معلومات الضمان' },
    verify_at: { en: 'Verify at', ar: 'التحقق عبر' },
    scan_to_verify: { en: 'Scan to verify', ar: 'امسح للتحقق' },
    cr_number: { en: 'CR', ar: 'السجل التجاري' },
    payment_method: { en: 'Payment Method', ar: 'طريقة الدفع' },
    payment_status: { en: 'Payment Status', ar: 'حالة الدفع' },
    paid: { en: 'Paid', ar: 'مدفوع' },
    cash: { en: 'Cash', ar: 'نقداً' },

    // Footer
    generated_via: { en: 'Generated via QScrap Platform', ar: 'صدرت عبر منصة كيو سكراب' },
    customer_info: { en: 'Customer', ar: 'العميل' },
};

// ============================================
// INVOICE GENERATION (ENHANCED)
// ============================================

export const generateInvoice = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    // NEW: Invoice type - defaults based on user type
    const invoiceType: InvoiceType = (req.query.type as InvoiceType) ||
        (userType === 'garage' ? 'garage' : 'customer');

    try {
        // Get order details with all related information
        const orderResult = await pool.query(`
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
                r.part_description as part_name,
                r.part_number
            FROM orders o
            JOIN users u ON o.customer_id = u.user_id
            JOIN garages g ON o.garage_id = g.garage_id
            JOIN users gu ON g.garage_id = gu.user_id
            JOIN bids b ON o.bid_id = b.bid_id
            JOIN part_requests r ON b.request_id = r.request_id
            WHERE o.order_id = $1
        `, [order_id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];

        // Check authorization
        if (userType === 'customer' && order.customer_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (userType === 'garage' && order.garage_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Check if invoice of this type already exists (check via document_data->>'invoice_type')
        const existingDoc = await pool.query(`
            SELECT * FROM documents 
            WHERE order_id = $1 
              AND document_type = 'invoice'
              AND document_data->>'invoice_type' = $2
              AND status != 'voided'
        `, [order_id, invoiceType]);

        if (existingDoc.rows.length > 0) {
            return res.json({
                document: existingDoc.rows[0],
                message: `${invoiceType === 'garage' ? 'Garage payout statement' : 'Customer invoice'} already exists`
            });
        }

        // Generate document number and verification code
        const docNumberResult = await pool.query(
            `SELECT generate_document_number('invoice') as doc_number`
        );
        const docNumber = docNumberResult.rows[0].doc_number;

        const verifyCodeResult = await pool.query(
            `SELECT generate_verification_code() as verify_code`
        );
        const verifyCode = verifyCodeResult.rows[0].verify_code;

        // Calculate warranty expiry
        const warrantyDays = order.warranty_days || 30;
        const warrantyExpiry = new Date();
        warrantyExpiry.setDate(warrantyExpiry.getDate() + warrantyDays);

        // Calculate pricing values
        const partPrice = parseFloat(order.part_price || order.bid_amount);
        const platformFee = parseFloat(order.platform_fee || 0);
        const deliveryFee = parseFloat(order.delivery_fee || 0);
        const totalAmount = parseFloat(order.total_amount);
        const commissionRate = parseFloat(order.commission_rate || 0.15);
        const netPayout = parseFloat(order.garage_payout_amount || (partPrice - platformFee));

        // PARSE CATEGORY/SUBCATEGORY from Description (if formatted as [Cat - Sub] Desc)
        // User requested to keep ONLY Category and Subcategory
        let displayPartName = order.part_name;
        const catMatch = order.part_name.match(/^\[(.*?)\s-\s(.*?)\]/);
        if (catMatch) {
            // Found [Category - Subcategory] pattern
            // Keep ONLY "Category - Subcategory"
            displayPartName = `${catMatch[1]} - ${catMatch[2]}`;
        }


        // Build document data based on invoice type
        let documentData: DocumentData;

        if (invoiceType === 'garage') {
            // ========================================
            // GARAGE PAYOUT STATEMENT (B2B)
            // Shows: Part Price - Platform Fee = Net Payout
            // ========================================
            documentData = {
                invoice_type: 'garage',
                invoice_number: docNumber,
                invoice_date: new Date().toISOString(),
                order_number: order.order_number,
                labels: BILINGUAL_LABELS,

                // Garage (recipient of payout)
                garage: {
                    name: order.garage_name,
                    phone: order.garage_phone,
                    address: order.garage_address || 'Qatar',
                    cr_number: order.garage_cr_number || 'N/A',
                    trade_license: order.trade_license_number || null,
                },

                // Platform info
                platform: {
                    name: 'QScrap',
                    name_ar: 'كيو سكراب',
                },

                // Customer reference (for garage records)
                customer_ref: {
                    name: order.customer_name,
                    order_number: order.order_number,
                },

                // Item Details
                item: {
                    vehicle: `${order.car_make} ${order.car_model} ${order.car_year}`,
                    part_name: displayPartName,
                    part_number: order.part_number || 'N/A',
                    condition: formatConditionBilingual(order.part_condition),
                    warranty_days: warrantyDays,
                },

                // Pricing (Garage perspective - what they receive)
                pricing: {
                    part_price: partPrice,
                    commission_rate: commissionRate,
                    commission_rate_percent: `${Math.round(commissionRate * 100)}%`,
                    platform_fee: platformFee,
                    net_payout: netPayout,
                },

                // Verification
                verification: {
                    code: verifyCode,
                    url: `https://qscrap.qa/verify/${verifyCode}`,
                },

                // Payment info
                payment: {
                    method: order.payment_method || 'Cash',
                    status: order.payment_status || 'Completed',
                },
            };
        } else {
            // ========================================
            // CUSTOMER INVOICE (B2C)
            // Shows: Part Price + Delivery Fee = Total Paid
            // ========================================
            documentData = {
                invoice_type: 'customer',
                invoice_number: docNumber,
                invoice_date: new Date().toISOString(),
                order_number: order.order_number,
                labels: BILINGUAL_LABELS,

                // Seller (Garage) - Qatar Legal Requirements
                seller: {
                    name: order.garage_name,
                    phone: order.garage_phone,
                    address: order.garage_address || 'Qatar',
                    cr_number: order.garage_cr_number || 'N/A',
                    trade_license: order.trade_license_number || null,
                },

                // Buyer (Customer)
                buyer: {
                    name: order.customer_name,
                    phone: order.customer_phone,
                    address: order.delivery_address || 'N/A',
                },

                // Item Details
                item: {
                    vehicle: `${order.car_make} ${order.car_model} ${order.car_year}`,
                    part_name: displayPartName,
                    part_number: order.part_number || 'N/A',
                    condition: formatConditionBilingual(order.part_condition),
                    warranty_days: warrantyDays,
                    warranty_expiry: warrantyExpiry.toISOString(),
                },

                // Pricing (Customer perspective - what they paid)
                pricing: {
                    part_price: partPrice,
                    delivery_fee: deliveryFee,
                    vat_rate: 0, // Qatar currently has no VAT
                    vat_amount: 0,
                    total: totalAmount,
                },

                // Verification
                verification: {
                    code: verifyCode,
                    url: `https://qscrap.qa/verify/${verifyCode}`,
                },

                // Payment
                payment: {
                    method: order.payment_method || 'Cash',
                    status: order.payment_status || 'Paid',
                },

                // No notes field - official invoice per Qatar Ministry requirements
            };
        }

        // Generate QR code
        let qrCodeData = '';
        if (QRCode) {
            try {
                qrCodeData = await (QRCode as { toDataURL: (text: string, opts: { width: number; margin: number }) => Promise<string> }).toDataURL(
                    `https://qscrap.qa/verify/${verifyCode}`,
                    { width: 150, margin: 1 }
                );
            } catch (qrErr) {
                console.error('QR generation error:', qrErr);
            }
        }

        // Create digital signature hash
        const signatureData = `${docNumber}|${order_id}|${invoiceType}|${order.total_amount}|${new Date().toISOString()}`;
        const digitalSignature = crypto
            .createHash('sha256')
            .update(signatureData)
            .digest('hex');

        // Insert document record with type-specific document_type
        const insertResult = await pool.query(`
            INSERT INTO documents (
                document_type,
                document_number,
                order_id,
                customer_id,
                garage_id,
                document_data,
                verification_code,
                verification_url,
                qr_code_data,
                digital_signature,
                signature_timestamp,
                status,
                created_by,
                created_by_type,
                ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            'invoice',  // Use standard 'invoice' type (constraint compliant)
            docNumber,
            order_id,
            order.customer_id,
            order.garage_id,
            JSON.stringify(documentData),
            verifyCode,
            `https://qscrap.qa/verify/${verifyCode}`,
            qrCodeData,
            digitalSignature,
            new Date(),
            'generated',
            userId,
            userType,
            req.ip
        ]);

        const document = insertResult.rows[0];

        // Log access
        await logDocumentAccess(document.document_id, 'generate', userId, userType, req);

        res.status(201).json({
            success: true,
            invoice_type: invoiceType,
            document: {
                ...document,
                document_data: documentData,
            }
        });

    } catch (err) {
        console.error('generateInvoice Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GET DOCUMENT
// ============================================

export const getDocument = async (req: AuthRequest, res: Response) => {
    const { document_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const result = await pool.query(`
            SELECT d.*, o.order_number, g.garage_name, u.full_name as customer_name
            FROM documents d
            LEFT JOIN orders o ON d.order_id = o.order_id
            LEFT JOIN garages g ON d.garage_id = g.garage_id
            LEFT JOIN users u ON d.customer_id = u.user_id
            WHERE d.document_id = $1
        `, [document_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = result.rows[0];

        // Authorization check
        if (userType === 'customer' && doc.customer_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (userType === 'garage' && doc.garage_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update viewed status
        if (!doc.viewed_at) {
            await pool.query(`
                UPDATE documents SET viewed_at = CURRENT_TIMESTAMP, status = 'viewed'
                WHERE document_id = $1 AND viewed_at IS NULL
            `, [document_id]);
        }

        // Log access
        await logDocumentAccess(document_id, 'view', userId, userType, req);

        res.json({ document: doc });

    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GET DOCUMENTS FOR ORDER
// ============================================

export const getOrderDocuments = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        // Verify access to order
        const orderCheck = await pool.query(`
            SELECT customer_id, garage_id FROM orders WHERE order_id = $1
        `, [order_id]);

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderCheck.rows[0];
        if (userType === 'customer' && order.customer_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (userType === 'garage' && order.garage_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const result = await pool.query(`
            SELECT * FROM documents 
            WHERE order_id = $1 AND status != 'voided'
            ORDER BY generated_at DESC
        `, [order_id]);

        res.json({ documents: result.rows });

    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// GET MY DOCUMENTS (Customer/Garage)
// ============================================

export const getMyDocuments = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userType = req.user!.userType;
    const { type, limit = 50 } = req.query;

    try {
        let whereClause = '';
        if (userType === 'customer') {
            whereClause = 'd.customer_id = $1';
        } else if (userType === 'garage') {
            whereClause = 'd.garage_id = $1';
        } else {
            // Admin/Operations can see all
            whereClause = '1=1';
        }

        let query = `
            SELECT d.*, o.order_number, g.garage_name
            FROM documents d
            LEFT JOIN orders o ON d.order_id = o.order_id
            LEFT JOIN garages g ON d.garage_id = g.garage_id
            WHERE ${whereClause} AND d.status != 'voided'
        `;

        const params: unknown[] = userType !== 'admin' && userType !== 'operations' ? [userId] : [];

        if (type) {
            query += ` AND d.document_type = $${params.length + 1}`;
            params.push(type);
        }

        query += ` ORDER BY d.generated_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);

        res.json({ documents: result.rows });

    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// DOWNLOAD DOCUMENT (PDF)
// ============================================

export const downloadDocument = async (req: AuthRequest, res: Response) => {
    const { document_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

    try {
        const result = await pool.query(`
            SELECT * FROM documents WHERE document_id = $1
        `, [document_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = result.rows[0];

        // Authorization
        if (userType === 'customer' && doc.customer_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (userType === 'garage' && doc.garage_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Generate PDF
        const pdfBuffer = await generatePDF(doc);

        // Update download status
        await pool.query(`
            UPDATE documents SET downloaded_at = CURRENT_TIMESTAMP, status = 'downloaded'
            WHERE document_id = $1
        `, [document_id]);

        // Log access
        await logDocumentAccess(document_id, 'download', userId, userType, req);

        // Send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.document_number}.pdf"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('downloadDocument Error:', err);
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// DOWNLOAD DOCUMENT WITH QUERY TOKEN (For browser opening)
// Specifically for mobile apps that open PDF in external browser
// ============================================

export const downloadDocumentWithToken = async (req: Request, res: Response) => {
    const { document_id } = req.params;
    const token = req.query.token as string;

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        // Verify JWT token from query parameter
        const payload = jwt.verify(token, getJwtSecret()) as { userId: string; userType: string };
        const userId = payload.userId;
        const userType = payload.userType;

        const result = await pool.query(`
            SELECT * FROM documents WHERE document_id = $1
        `, [document_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = result.rows[0];

        // Authorization
        if (userType === 'customer' && doc.customer_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        if (userType === 'garage' && doc.garage_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Generate PDF
        const pdfBuffer = await generatePDF(doc);

        // Update download status
        await pool.query(`
            UPDATE documents SET downloaded_at = CURRENT_TIMESTAMP, status = 'downloaded'
            WHERE document_id = $1
        `, [document_id]);

        // Log access
        await logDocumentAccess(document_id, 'download', userId, userType, req);

        // Send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.document_number}.pdf"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('downloadDocumentWithToken Error:', err);
        if ((err as Error).name === 'JsonWebTokenError' || (err as Error).name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// VERIFY DOCUMENT (Public)
// ============================================

export const verifyDocument = async (req: AuthRequest, res: Response) => {
    const { code } = req.params;

    try {
        const result = await pool.query(`
            SELECT 
                d.*,
                o.order_number,
                o.order_status,
                g.garage_name
            FROM documents d
            LEFT JOIN orders o ON d.order_id = o.order_id
            LEFT JOIN garages g ON d.garage_id = g.garage_id
            WHERE d.verification_code = $1
        `, [code]);

        if (result.rows.length === 0) {
            return res.json({
                verified: false,
                message: 'Invalid verification code'
            });
        }

        const doc = result.rows[0];
        const docData = doc.document_data;

        // Log public verification
        await pool.query(`
            INSERT INTO document_access_log (document_id, action, actor_type, ip_address, user_agent)
            VALUES ($1, 'verify', 'public', $2, $3)
        `, [doc.document_id, req.ip, req.headers['user-agent']]);

        res.json({
            verified: true,
            document: {
                type: doc.document_type,
                number: doc.document_number,
                date: doc.generated_at,
                order_number: doc.order_number,
                garage: doc.garage_name,
                status: doc.status,
                digital_signature: doc.digital_signature?.substring(0, 16) + '...',
                signature_timestamp: doc.signature_timestamp,
            },
            item: docData?.item || {},
            pricing: docData?.pricing || {},
        });

    } catch (err) {
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getLogoBase64(): string {
    try {
        const logoPath = path.join(__dirname, '../../public/assets/images/qscrap-logo.png');
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            return `data:image/png;base64,${logoBuffer.toString('base64')}`;
        }
    } catch (err) {
        console.error('Error reading logo file:', err);
    }
    return ''; // Return empty string if failed
}

async function generatePDF(doc: { document_data: DocumentData | string; qr_code_data?: string;[key: string]: unknown }): Promise<Buffer> {
    const docData = typeof doc.document_data === 'string'
        ? JSON.parse(doc.document_data)
        : doc.document_data;

    // Get logo
    const logoBase64 = getLogoBase64();

    // Select template based on invoice type
    let html: string;
    if (docData.invoice_type === 'garage') {
        html = generateGaragePayoutStatementHTML(docData, doc.qr_code_data || '', logoBase64);
    } else {
        html = generateBilingualCustomerInvoiceHTML(docData, doc.qr_code_data || '', logoBase64);
    }

    if (!puppeteer) {
        console.warn('Puppeteer not available, returning HTML');
        return Buffer.from(html, 'utf-8');
    }

    try {
        const browser = await (puppeteer as { launch: (opts: unknown) => Promise<{ newPage: () => Promise<unknown>; close: () => Promise<void> }> }).launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage() as { setContent: (html: string, opts: { waitUntil: string }) => Promise<void>; pdf: (opts: unknown) => Promise<Uint8Array> };
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfUint8 = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
        });

        await browser.close();
        return Buffer.from(pdfUint8);
    } catch (err) {
        console.error('PDF generation error:', err);
        return Buffer.from(html, 'utf-8');
    }
}

// ============================================
// BILINGUAL CUSTOMER INVOICE TEMPLATE (B2C)
// Arabic + English, Qatar MoC Compliant
// ============================================
function generateBilingualCustomerInvoiceHTML(data: DocumentData, qrCode: string, logoBase64: string = ''): string {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const formatMoney = (n: number) => n.toLocaleString('en-QA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const L = data.labels || BILINGUAL_LABELS;
    const cond = data.item?.condition || { en: 'N/A', ar: 'غير محدد' };

    return `<!DOCTYPE html>
<html dir="ltr">
<head>
    <meta charset="UTF-8">
    <title>Invoice ${data.invoice_number}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1a1a1a; background: white; }
        .invoice { max-width: 210mm; margin: 0 auto; padding: 12mm; }
        .arabic { font-family: 'Noto Sans Arabic', sans-serif; direction: rtl; text-align: right; }
        
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a1a1a; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { font-size: 28px; font-weight: 700; }
        .title-block { text-align: center; }
        .title-en { font-size: 18px; font-weight: 700; letter-spacing: 2px; }
        .title-ar { font-size: 16px; font-weight: 600; margin-top: 4px; }
        .doc-number { font-size: 12px; color: #666; margin-top: 8px; }
        
        /* Info Grid */
        .info-grid { display: flex; gap: 15px; margin-bottom: 20px; }
        .info-box { flex: 1; border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
        .info-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 8px; }
        .info-label-en { font-weight: 600; font-size: 10px; text-transform: uppercase; color: #666; }
        .info-label-ar { font-weight: 600; font-size: 10px; }
        .info-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .info-detail { font-size: 10px; color: #444; margin-bottom: 2px; }
        
        /* Table */
        .section { border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; }
        .section-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px; }
        .item-table { width: 100%; border-collapse: collapse; }
        .item-table th { background: #f8f8f8; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
        .item-table th.ar { text-align: right; }
        .item-table td { padding: 12px 8px; border-bottom: 1px solid #eee; }
        
        /* Totals */
        .totals { width: 280px; margin-left: auto; margin-top: 15px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .total-row.grand { font-size: 14px; font-weight: 700; background: #f0f0f0; padding: 12px 10px; border-radius: 4px; margin-top: 8px; border: none; }
        
        /* Footer */
        .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; padding-top: 15px; border-top: 2px solid #1a1a1a; }
        .qr-code img { width: 90px; height: 90px; }
        .qr-label { font-size: 9px; color: #666; margin-top: 4px; text-align: center; }
        .verify-info { font-size: 9px; color: #555; }
        
        @media print { body { -webkit-print-color-adjust: exact; } }
    </style>
</head>
<body>
    <div class="invoice">
        <!-- Header -->
        <div class="header">
            <div class="logo">
                ${logoBase64 ? `<img src="${logoBase64}" alt="QScrap" style="height: 60px;">` : '🔧 QSCRAP'}
            </div>
            <div class="title-block">
                <div class="title-en">${L.customer_invoice_title?.en || 'TAX INVOICE'}</div>
                <div class="title-ar arabic">${L.customer_invoice_title?.ar || 'فاتورة ضريبية'}</div>
                <div class="doc-number">${data.invoice_number}</div>
            </div>
            <div style="text-align: right;">
                <div>${formatDate(data.invoice_date || '')}</div>
                <div class="arabic" style="font-size: 10px; color: #666;">${L.invoice_date?.ar || 'تاريخ الفاتورة'}</div>
            </div>
        </div>
        
        <!-- Seller & Buyer -->
        <div class="info-grid">
            <div class="info-box">
                <div class="info-header">
                    <span class="info-label-en">${L.seller?.en || 'Seller'}</span>
                    <span class="info-label-ar arabic">${L.seller?.ar || 'البائع'}</span>
                </div>
                <div class="info-name">${data.seller?.name || 'N/A'}</div>
                <div class="info-detail">📞 ${data.seller?.phone || 'N/A'}</div>
                <div class="info-detail">📍 ${data.seller?.address || 'Qatar'}</div>
                ${data.seller?.cr_number ? `<div class="info-detail">${L.cr_number?.en || 'CR'}: ${data.seller.cr_number}</div>` : ''}
            </div>
            <div class="info-box">
                <div class="info-header">
                    <span class="info-label-en">${L.buyer?.en || 'Buyer'}</span>
                    <span class="info-label-ar arabic">${L.buyer?.ar || 'المشتري'}</span>
                </div>
                <div class="info-name">${data.buyer?.name || 'N/A'}</div>
                <div class="info-detail">📞 ${data.buyer?.phone || 'N/A'}</div>
                <div class="info-detail">📍 ${data.buyer?.address || 'N/A'}</div>
            </div>
        </div>
        
        <!-- Order Number -->
        <div class="info-grid">
            <div class="info-box" style="flex: 0.5;">
                <div class="info-header">
                    <span class="info-label-en">${L.order_number?.en || 'Order Number'}</span>
                    <span class="info-label-ar arabic">${L.order_number?.ar || 'رقم الطلب'}</span>
                </div>
                <div class="info-name">${data.order_number}</div>
            </div>
        </div>
        
        <!-- Item Details -->
        <div class="section">
            <div class="section-header">
                <span style="font-weight: 600; font-size: 11px;">${L.item_details?.en || 'Item Details'}</span>
                <span class="arabic" style="font-weight: 600; font-size: 11px;">${L.item_details?.ar || 'تفاصيل القطعة'}</span>
            </div>
            <table class="item-table">
                <thead>
                    <tr>
                        <th style="width: 40%">${L.item?.en || 'Item'}</th>
                        <th>${L.condition?.en || 'Condition'}</th>
                        <th>${L.warranty?.en || 'Warranty'}</th>
                        <th style="text-align: right">${L.amount?.en || 'Amount'}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>${data.item?.part_name || 'Auto Part'}</strong><br>
                            <span style="color: #666; font-size: 10px;">
                                Vehicle: ${data.item?.vehicle || 'N/A'}<br>
                                Part #: ${data.item?.part_number || 'N/A'}
                            </span>
                        </td>
                        <td>${cond.en} <span class="arabic" style="color: #666; font-size: 10px;">(${cond.ar})</span></td>
                        <td>${data.item?.warranty_days || 30} ${L.days?.en || 'Days'}</td>
                        <td style="text-align: right; font-weight: 600;">${formatMoney(data.pricing?.part_price || 0)} QAR</td>
                    </tr>
                </tbody>
            </table>
            
            <!-- Totals -->
            <div class="totals">
                <div class="total-row">
                    <span>${L.part_price?.en || 'Part Price'} <span class="arabic" style="color: #888; font-size: 9px;">${L.part_price?.ar || 'سعر القطعة'}</span></span>
                    <span>${formatMoney(data.pricing?.part_price || 0)} QAR</span>
                </div>
                ${(data.pricing?.delivery_fee || 0) > 0 ? `
                <div class="total-row">
                    <span>${L.delivery_fee?.en || 'Delivery Fee'} <span class="arabic" style="color: #888; font-size: 9px;">${L.delivery_fee?.ar || 'رسوم التوصيل'}</span></span>
                    <span>${formatMoney(data.pricing?.delivery_fee || 0)} QAR</span>
                </div>` : ''}
                <div class="total-row grand">
                    <span>${L.total_paid?.en || 'Total Paid'} <span class="arabic">${L.total_paid?.ar || 'إجمالي المدفوع'}</span></span>
                    <span>${formatMoney(data.pricing?.total || 0)} QAR</span>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="verify-info">
                <strong>${L.verify_at?.en || 'Verify at'}:</strong> qscrap.qa/verify<br>
                <div style="font-family: monospace; border: 1px solid #ddd; padding: 4px 8px; margin-top: 4px; display: inline-block;">${data.verification?.code || 'N/A'}</div>
                <br><br>
                <span style="color: #999;">${L.generated_via?.en || 'Generated via QScrap Platform'} • ${formatDate(data.invoice_date || '')}</span>
            </div>
            <div class="qr-code">
                ${qrCode ? `<img src="${qrCode}" alt="QR Code">` : ''}
                <div class="qr-label">${L.scan_to_verify?.en || 'Scan to verify'} / ${L.scan_to_verify?.ar || 'امسح للتحقق'}</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// ============================================
// GARAGE PAYOUT STATEMENT TEMPLATE (B2B)
// Arabic + English, Shows Platform Fees
// ============================================
function generateGaragePayoutStatementHTML(data: DocumentData, qrCode: string, logoBase64: string = ''): string {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const formatMoney = (n: number) => n.toLocaleString('en-QA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const L = data.labels || BILINGUAL_LABELS;
    const cond = data.item?.condition || { en: 'N/A', ar: 'غير محدد' };

    return `<!DOCTYPE html>
<html dir="ltr">
<head>
    <meta charset="UTF-8">
    <title>Payout Statement ${data.invoice_number}</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1a1a1a; background: white; }
        .invoice { max-width: 210mm; margin: 0 auto; padding: 12mm; }
        .arabic { font-family: 'Noto Sans Arabic', sans-serif; direction: rtl; text-align: right; }
        
        /* Header - Blue theme for payout statement */
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1a56db; padding-bottom: 15px; margin-bottom: 20px; }
        .logo { font-size: 28px; font-weight: 700; color: #1a56db; }
        .title-block { text-align: center; }
        .title-en { font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #1a56db; }
        .title-ar { font-size: 16px; font-weight: 600; margin-top: 4px; color: #1a56db; }
        .doc-number { font-size: 12px; color: #666; margin-top: 8px; }
        
        /* Info Grid */
        .info-grid { display: flex; gap: 15px; margin-bottom: 20px; }
        .info-box { flex: 1; border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
        .info-box.highlight { background: #f0f5ff; border-color: #1a56db; }
        .info-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 8px; }
        .info-label-en { font-weight: 600; font-size: 10px; text-transform: uppercase; color: #666; }
        .info-label-ar { font-weight: 600; font-size: 10px; }
        .info-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .info-detail { font-size: 10px; color: #444; margin-bottom: 2px; }
        
        /* Section */
        .section { border: 1px solid #ccc; border-radius: 4px; padding: 15px; margin-bottom: 15px; }
        .section-header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px; }
        
        /* Pricing Breakdown */
        .pricing-breakdown { background: #fafafa; border-radius: 4px; padding: 15px; }
        .price-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .price-row:last-child { border-bottom: none; }
        .price-row.fee { color: #dc2626; }
        .price-row.payout { background: #dcfce7; margin: 8px -15px -15px; padding: 15px; border-radius: 0 0 4px 4px; font-size: 16px; font-weight: 700; color: #166534; }
        .price-label { display: flex; flex-direction: column; }
        .price-label-ar { font-size: 9px; color: #888; }
        
        /* Footer */
        .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 25px; padding-top: 15px; border-top: 2px solid #1a56db; }
        .qr-code img { width: 80px; height: 80px; }
        .qr-label { font-size: 9px; color: #666; margin-top: 4px; text-align: center; }
        
        @media print { body { -webkit-print-color-adjust: exact; } }
    </style>
</head>
<body>
    <div class="invoice">
        <!-- Header -->
        <div class="header">
            <div class="logo">
                ${logoBase64 ? `<img src="${logoBase64}" alt="QScrap" style="height: 60px;">` : '🔧 QSCRAP'}
            </div>
            <div class="title-block">
                <div class="title-en">${L.garage_invoice_title?.en || 'PAYOUT STATEMENT'}</div>
                <div class="title-ar arabic">${L.garage_invoice_title?.ar || 'كشف حساب الورشة'}</div>
                <div class="doc-number">${data.invoice_number}</div>
            </div>
            <div style="text-align: right;">
                <div>${formatDate(data.invoice_date || '')}</div>
                <div class="arabic" style="font-size: 10px; color: #666;">${L.statement_date?.ar || 'تاريخ الكشف'}</div>
            </div>
        </div>
        
        <!-- Garage & Platform Info -->
        <div class="info-grid">
            <div class="info-box highlight">
                <div class="info-header">
                    <span class="info-label-en">GARAGE / الورشة</span>
                </div>
                <div class="info-name">${data.garage?.name || 'N/A'}</div>
                <div class="info-detail">📞 ${data.garage?.phone || 'N/A'}</div>
                <div class="info-detail">📍 ${data.garage?.address || 'Qatar'}</div>
                ${data.garage?.cr_number && data.garage.cr_number !== 'N/A' ? `<div class="info-detail">${L.cr_number?.en || 'CR'}: ${data.garage.cr_number}</div>` : ''}
            </div>
            <div class="info-box">
                <div class="info-header">
                    <span class="info-label-en">${L.platform?.en || 'Platform'} / ${L.platform?.ar || 'المنصة'}</span>
                </div>
                <div class="info-name">${data.platform?.name || 'QScrap'} <span class="arabic">${data.platform?.name_ar || 'كيو سكراب'}</span></div>
                <div class="info-detail">Order: ${data.customer_ref?.order_number || data.order_number}</div>
                <div class="info-detail">Customer: ${data.customer_ref?.name || 'N/A'}</div>
            </div>
        </div>
        
        <!-- Item Sold -->
        <div class="section">
            <div class="section-header">
                <span style="font-weight: 600; font-size: 11px;">${L.item_details?.en || 'Item Details'}</span>
                <span class="arabic" style="font-weight: 600; font-size: 11px;">${L.item_details?.ar || 'تفاصيل القطعة'}</span>
            </div>
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 13px; margin-bottom: 5px;">${data.item?.part_name || 'Auto Part'}</div>
                    <div style="font-size: 10px; color: #666;">Vehicle: ${data.item?.vehicle || 'N/A'}</div>
                    <div style="font-size: 10px; color: #666;">Part #: ${data.item?.part_number || 'N/A'}</div>
                </div>
                <div>
                    <div style="font-size: 10px; color: #666;">${L.condition?.en || 'Condition'}</div>
                    <div style="font-weight: 600;">${cond.en} <span class="arabic" style="color: #666;">(${cond.ar})</span></div>
                </div>
            </div>
        </div>
        
        <!-- Payout Breakdown -->
        <div class="section">
            <div class="section-header">
                <span style="font-weight: 600; font-size: 11px;">PAYOUT BREAKDOWN</span>
                <span class="arabic" style="font-weight: 600; font-size: 11px;">تفاصيل المستحقات</span>
            </div>
            <div class="pricing-breakdown">
                <div class="price-row">
                    <div class="price-label">
                        <span>${L.part_price?.en || 'Part Price'}</span>
                        <span class="price-label-ar arabic">${L.part_price?.ar || 'سعر القطعة'}</span>
                    </div>
                    <span style="font-weight: 600;">${formatMoney(data.pricing?.part_price || 0)} QAR</span>
                </div>
                <div class="price-row fee">
                    <div class="price-label">
                        <span>${L.platform_fee?.en || 'Platform Fee'} (${data.pricing?.commission_rate_percent || '15%'})</span>
                        <span class="price-label-ar arabic">${L.platform_fee?.ar || 'رسوم المنصة'}</span>
                    </div>
                    <span style="font-weight: 600;">- ${formatMoney(data.pricing?.platform_fee || 0)} QAR</span>
                </div>
                <div class="price-row payout">
                    <div class="price-label">
                        <span>${L.your_earnings?.en || 'Your Earnings'}</span>
                        <span class="arabic" style="font-size: 12px;">${L.your_earnings?.ar || 'أرباحك'}</span>
                    </div>
                    <span>${formatMoney(data.pricing?.net_payout || 0)} QAR</span>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div style="font-size: 9px; color: #555;">
                <strong>Order:</strong> ${data.order_number}<br>
                <strong>Payment Status:</strong> ${data.payment?.status || 'Completed'}<br>
                <span style="color: #999; margin-top: 10px; display: block;">${L.generated_via?.en || 'Generated via QScrap Platform'}</span>
            </div>
            <div class="qr-code">
                ${qrCode ? `<img src="${qrCode}" alt="QR Code">` : ''}
                <div class="qr-label">${L.scan_to_verify?.en || 'Scan to verify'}</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function generateInvoiceHTML(data: DocumentData, qrCode: string): string {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('en-QA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice ${data.invoice_number}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Times New Roman', Times, serif;
            font-size: 11px;
            color: #000;
            line-height: 1.5;
            background: white;
        }
        .invoice { max-width: 210mm; margin: 0 auto; padding: 15mm; }
        
        /* Header */
        .header { 
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .logo { font-size: 24px; font-weight: bold; color: #000; }
        .logo-icon { margin-right: 8px; }
        .invoice-title { 
            text-align: right;
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .invoice-number { 
            font-size: 12px;
            margin-top: 5px;
        }
        
        /* Info Section */
        .info-row {
            display: flex;
            margin-bottom: 20px;
        }
        .info-col { 
            flex: 1; 
            padding: 15px;
            border: 1px solid #000;
        }
        .info-col:first-child { border-right: none; }
        .info-label { 
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
        }
        .info-name { font-size: 13px; font-weight: bold; margin-bottom: 3px; }
        .info-detail { color: #333; margin-bottom: 2px; }
        
        /* Order Details */
        .section { 
            border: 1px solid #000;
            padding: 15px;
            margin-bottom: 15px;
        }
        .section-title {
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #ccc;
        }
        
        /* Item Table */
        .item-table { width: 100%; border-collapse: collapse; }
        .item-table th { 
            text-align: left; 
            padding: 8px;
            background: #f5f5f5;
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
            border: 1px solid #000;
        }
        .item-table td { 
            padding: 10px 8px;
            border: 1px solid #000;
        }
        
        /* Totals */
        .totals { 
            width: 250px;
            margin-left: auto;
            margin-top: 15px;
        }
        .total-row { 
            display: flex; 
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid #ccc;
        }
        .total-row.grand { 
            font-size: 14px;
            font-weight: bold;
            border-bottom: 2px solid #000;
            border-top: 2px solid #000;
            padding: 10px 0;
            margin-top: 5px;
        }
        
        /* Warranty */
        .warranty { 
            border: 2px solid #000;
            padding: 12px 15px;
            margin-top: 15px;
        }
        .warranty-title { font-weight: bold; margin-bottom: 5px; text-transform: uppercase; font-size: 10px; }
        .warranty-detail { font-size: 10px; }
        
        /* Footer */
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px solid #000;
        }
        .verify-info { font-size: 9px; color: #333; }
        .verify-code { 
            font-family: 'Courier New', monospace;
            border: 1px solid #ccc;
            padding: 3px 8px;
            margin-top: 3px;
            font-size: 9px;
        }
        .qr-code { text-align: right; }
        .qr-code img { width: 80px; height: 80px; }
        .qr-label { font-size: 8px; color: #666; margin-top: 3px; }
        
        /* Bilingual */
        .arabic { 
            direction: rtl; 
            text-align: right;
            font-family: 'Arial', sans-serif;
        }
        
        /* Print optimization */
        @media print {
            body { -webkit-print-color-adjust: exact; }
            .invoice { padding: 10mm; }
        }
    </style>
</head>
<body>
    <div class="invoice">
        <!-- Header -->
        <div class="header">
            <div class="logo">
                <span class="logo-icon">🔧</span>QSCRAP
            </div>
            <div class="invoice-title">
                TAX INVOICE
                <div class="invoice-number">${data.invoice_number}</div>
            </div>
        </div>
        
        <!-- Seller & Buyer -->
        <div class="info-row">
            <div class="info-col">
                <div class="info-label">Seller</div>
                <div class="info-name">${data.seller?.name || 'N/A'}</div>
                <div class="info-detail">📞 ${data.seller?.phone || 'N/A'}</div>
                <div class="info-detail">📍 ${data.seller?.address || 'N/A'}</div>
                ${data.seller?.cr_number ? `<div class="info-detail">CR: ${data.seller.cr_number}</div>` : ''}
            </div>
            <div class="info-col">
                <div class="info-label">Buyer</div>
                <div class="info-name">${data.buyer?.name || 'N/A'}</div>
                <div class="info-detail">📞 ${data.buyer?.phone || 'N/A'}</div>
                <div class="info-detail">📍 ${data.buyer?.address || 'N/A'}</div>
            </div>
        </div>
        
        <!-- Order & Date -->
        <div class="info-row">
            <div class="info-col">
                <div class="info-label">Order Number</div>
                <div class="info-name">${data.order_number}</div>
            </div>
            <div class="info-col">
                <div class="info-label">Invoice Date</div>
                <div class="info-name">${formatDate(data.invoice_date || '')}</div>
            </div>
        </div>
        
        <!-- Item Details -->
        <div class="section">
            <div class="section-title">Item Details</div>
            <table class="item-table">
                <thead>
                    <tr>
                        <th style="width: 40%">Description</th>
                        <th>Condition</th>
                        <th>Warranty</th>
                        <th style="text-align: right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>${data.item?.part_name || 'Auto Part'}</strong><br>
                            <span style="color: #666; font-size: 11px;">
                                Vehicle: ${data.item?.vehicle || 'N/A'}<br>
                                Part #: ${data.item?.part_number || 'N/A'}
                            </span>
                        </td>
                        <td>${data.item?.condition || 'N/A'}</td>
                        <td>${data.item?.warranty_days || 0} Days</td>
                        <td style="text-align: right; font-weight: 600;">
                            ${formatMoney(data.pricing?.subtotal || 0)} QAR
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <!-- Totals -->
            <div class="totals">
                <div class="total-row">
                    <span>Subtotal</span>
                    <span>${formatMoney(data.pricing?.subtotal || 0)} QAR</span>
                </div>
                ${(data.pricing?.delivery_fee || 0) > 0 ? `
                <div class="total-row">
                    <span>Delivery</span>
                    <span>${formatMoney(data.pricing?.delivery_fee || 0)} QAR</span>
                </div>
                ` : ''}
                ${(data.pricing?.vat_amount || 0) > 0 ? `
                <div class="total-row">
                    <span>VAT (${data.pricing?.vat_rate || 0}%)</span>
                    <span>${formatMoney(data.pricing?.vat_amount || 0)} QAR</span>
                </div>
                ` : ''}
                <div class="total-row grand">
                    <span>TOTAL</span>
                    <span>${formatMoney(data.pricing?.total || 0)} QAR</span>
                </div>
            </div>
        </div>
        
        <!-- Warranty Box -->
        <div class="warranty">
            <div class="warranty-title">⚡ WARRANTY INFORMATION</div>
            <div class="warranty-detail">
                This part comes with a ${data.item?.warranty_days || 30}-day warranty valid until 
                ${formatDate(data.item?.warranty_expiry || new Date().toISOString())}.
                Coverage includes manufacturing defects and material failures. 
                Contact the seller for warranty claims.
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="verify-info">
                <strong>Verify this invoice at:</strong> qscrap.qa/verify<br>
                <div class="verify-code">${data.verification?.code || 'N/A'}</div>
                <br>
                <span style="font-size: 10px; color: #999;">
                    Generated via QScrap Platform • ${formatDate(data.invoice_date || '')}
                </span>
            </div>
            <div class="qr-code">
                ${qrCode ? `<img src="${qrCode}" alt="QR Code">` : ''}
                <div class="qr-label">Scan to verify</div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function formatCondition(condition: string): string {
    const conditions: Record<string, string> = {
        'new': 'New',
        'used_excellent': 'Used - Excellent',
        'used_good': 'Used - Good',
        'used_fair': 'Used - Fair',
        'refurbished': 'Refurbished',
    };
    return conditions[condition] || condition || 'N/A';
}

// Bilingual condition formatter for Arabic/English invoices
function formatConditionBilingual(condition: string): { en: string; ar: string } {
    const conditions: Record<string, { en: string; ar: string }> = {
        'new': { en: 'New', ar: 'جديد' },
        'used_excellent': { en: 'Used - Excellent', ar: 'مستعمل - ممتاز' },
        'used_good': { en: 'Used - Good', ar: 'مستعمل - جيد' },
        'used_fair': { en: 'Used - Fair', ar: 'مستعمل - مقبول' },
        'refurbished': { en: 'Refurbished', ar: 'مجدد' },
    };
    return conditions[condition] || { en: condition || 'N/A', ar: condition || 'غير محدد' };
}

async function logDocumentAccess(
    documentId: string,
    action: string,
    actorId: string | null,
    actorType: string,
    req: { ip?: string; headers: Record<string, unknown> }
) {
    try {
        await pool.query(`
            INSERT INTO document_access_log (document_id, action, actor_id, actor_type, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [documentId, action, actorId, actorType, req.ip, req.headers['user-agent']]);
    } catch (err) {
        console.error('Failed to log document access:', err);
    }
}
