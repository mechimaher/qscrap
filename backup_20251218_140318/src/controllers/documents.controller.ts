import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Import puppeteer for PDF generation
let puppeteer: any;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.warn('Puppeteer not available, PDF generation will be limited');
}

// Import QRCode generator
let QRCode: any;
try {
    QRCode = require('qrcode');
} catch (e) {
    console.warn('QRCode not available');
}

// ============================================
// INVOICE GENERATION
// ============================================

export const generateInvoice = async (req: AuthRequest, res: Response) => {
    const { order_id } = req.params;
    const userId = req.user!.userId;
    const userType = req.user!.userType;

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

        // Check if invoice already exists
        const existingDoc = await pool.query(`
            SELECT * FROM documents 
            WHERE order_id = $1 AND document_type = 'invoice' AND status != 'voided'
        `, [order_id]);

        if (existingDoc.rows.length > 0) {
            // Return existing invoice
            return res.json({
                document: existingDoc.rows[0],
                message: 'Invoice already exists'
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

        // Build document data (bilingual)
        const documentData = {
            // Header
            invoice_number: docNumber,
            invoice_date: new Date().toISOString(),
            order_number: order.order_number,

            // Seller (Garage) - Qatar Legal Requirements
            seller: {
                name: order.garage_name,
                phone: order.garage_phone,
                address: order.garage_address || 'Qatar',
                cr_number: order.garage_cr_number || 'CR Not Registered',
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
                part_name: order.part_name,
                part_number: order.part_number || 'N/A',
                condition: formatCondition(order.part_condition),
                warranty_days: warrantyDays,
                warranty_expiry: warrantyExpiry.toISOString(),
            },

            // Pricing
            pricing: {
                subtotal: parseFloat(order.bid_amount),
                platform_fee: parseFloat(order.platform_fee || 0),
                delivery_fee: parseFloat(order.delivery_fee || 0),
                vat_rate: 0, // Qatar currently has no VAT
                vat_amount: 0,
                total: parseFloat(order.total_amount),
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

            // Notes
            notes: order.bid_notes || '',
        };

        // Generate QR code
        let qrCodeData = '';
        if (QRCode) {
            try {
                qrCodeData = await QRCode.toDataURL(
                    `https://qscrap.qa/verify/${verifyCode}`,
                    { width: 150, margin: 1 }
                );
            } catch (qrErr) {
                console.error('QR generation error:', qrErr);
            }
        }

        // Create digital signature hash
        const signatureData = `${docNumber}|${order_id}|${order.total_amount}|${new Date().toISOString()}`;
        const digitalSignature = crypto
            .createHash('sha256')
            .update(signatureData)
            .digest('hex');

        // Insert document record
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
            'invoice',
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
            document: {
                ...document,
                document_data: documentData, // Include parsed data
            }
        });

    } catch (err: any) {
        console.error('generateInvoice Error:', err);
        res.status(500).json({ error: err.message });
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

    } catch (err: any) {
        res.status(500).json({ error: err.message });
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

    } catch (err: any) {
        res.status(500).json({ error: err.message });
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

        const params: any[] = userType !== 'admin' && userType !== 'operations' ? [userId] : [];

        if (type) {
            query += ` AND d.document_type = $${params.length + 1}`;
            params.push(type);
        }

        query += ` ORDER BY d.generated_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await pool.query(query, params);

        res.json({ documents: result.rows });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
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

    } catch (err: any) {
        console.error('downloadDocument Error:', err);
        res.status(500).json({ error: err.message });
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

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function generatePDF(doc: any): Promise<Buffer> {
    const docData = typeof doc.document_data === 'string'
        ? JSON.parse(doc.document_data)
        : doc.document_data;

    // Simple HTML template for invoice
    const html = generateInvoiceHTML(docData, doc.qr_code_data);

    if (!puppeteer) {
        // Fallback: Return HTML as buffer if puppeteer not available
        console.warn('Puppeteer not available, returning HTML');
        return Buffer.from(html, 'utf-8');
    }

    try {
        const browser = await puppeteer.launch({
            headless: 'new', // Use new headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        // page.pdf() returns Uint8Array in newer Puppeteer versions
        const pdfUint8 = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
        });

        await browser.close();

        // Convert Uint8Array to Buffer
        return Buffer.from(pdfUint8);
    } catch (err) {
        console.error('PDF generation error:', err);
        // Return HTML as fallback with text/html content type hint
        return Buffer.from(html, 'utf-8');
    }
}

function generateInvoiceHTML(data: any, qrCode: string): string {
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
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            color: #333;
            line-height: 1.4;
        }
        .invoice { max-width: 210mm; margin: 0 auto; padding: 20px; }
        
        /* Header */
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 10px 10px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .logo { font-size: 28px; font-weight: bold; }
        .logo-icon { margin-right: 10px; }
        .invoice-title { 
            text-align: right;
            font-size: 24px;
            font-weight: 600;
        }
        .invoice-number { 
            font-size: 14px;
            opacity: 0.9;
            margin-top: 5px;
        }
        
        /* Info Section */
        .info-row {
            display: flex;
            border: 1px solid #e0e0e0;
            border-top: none;
        }
        .info-col { 
            flex: 1; 
            padding: 20px;
        }
        .info-col:first-child { border-right: 1px solid #e0e0e0; }
        .info-label { 
            color: #667eea;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }
        .info-name { font-size: 16px; font-weight: 600; margin-bottom: 5px; }
        .info-detail { color: #666; margin-bottom: 3px; }
        
        /* Order Details */
        .section { 
            border: 1px solid #e0e0e0; 
            border-top: none;
            padding: 20px;
        }
        .section-title {
            color: #667eea;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
        }
        
        /* Item Table */
        .item-table { width: 100%; border-collapse: collapse; }
        .item-table th { 
            text-align: left; 
            padding: 10px;
            background: #f8f9fa;
            font-weight: 600;
            color: #555;
            font-size: 11px;
            text-transform: uppercase;
        }
        .item-table td { 
            padding: 12px 10px;
            border-bottom: 1px solid #f0f0f0;
        }
        
        /* Totals */
        .totals { 
            width: 300px;
            margin-left: auto;
            margin-top: 20px;
        }
        .total-row { 
            display: flex; 
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .total-row.grand { 
            font-size: 18px;
            font-weight: bold;
            color: #667eea;
            border-bottom: none;
            padding-top: 15px;
        }
        
        /* Warranty */
        .warranty { 
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .warranty-title { font-weight: 600; margin-bottom: 8px; }
        .warranty-detail { font-size: 11px; opacity: 0.9; }
        
        /* Footer */
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #f0f0f0;
        }
        .verify-info { font-size: 11px; color: #666; }
        .verify-code { 
            font-family: monospace;
            background: #f8f9fa;
            padding: 5px 10px;
            border-radius: 4px;
            margin-top: 5px;
        }
        .qr-code { text-align: right; }
        .qr-code img { width: 100px; height: 100px; }
        .qr-label { font-size: 10px; color: #999; margin-top: 5px; }
        
        /* Bilingual */
        .arabic { 
            direction: rtl; 
            text-align: right;
            font-family: 'Arial', sans-serif;
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
                <div class="info-name">${formatDate(data.invoice_date)}</div>
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
                ${data.pricing?.platform_fee > 0 ? `
                <div class="total-row">
                    <span>Platform Fee</span>
                    <span>${formatMoney(data.pricing.platform_fee)} QAR</span>
                </div>
                ` : ''}
                ${data.pricing?.delivery_fee > 0 ? `
                <div class="total-row">
                    <span>Delivery</span>
                    <span>${formatMoney(data.pricing.delivery_fee)} QAR</span>
                </div>
                ` : ''}
                ${data.pricing?.vat_amount > 0 ? `
                <div class="total-row">
                    <span>VAT (${data.pricing.vat_rate}%)</span>
                    <span>${formatMoney(data.pricing.vat_amount)} QAR</span>
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
                    Generated via QScrap Platform • ${formatDate(data.invoice_date)}
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

async function logDocumentAccess(
    documentId: string,
    action: string,
    actorId: string | null,
    actorType: string,
    req: any
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
