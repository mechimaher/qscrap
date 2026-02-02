/**
 * Invoice Service
 * Generate bilingual (AR/EN) PDF invoices for subscription payments
 */

import { Pool } from 'pg';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export class InvoiceService {
    private invoicesDir: string;

    constructor(private pool: Pool) {
        this.invoicesDir = process.env.INVOICES_DIR || '/opt/qscrap/invoices';

        // Ensure invoices directory exists
        if (!fs.existsSync(this.invoicesDir)) {
            fs.mkdirSync(this.invoicesDir, { recursive: true });
        }
    }

    /**
     * Generate PDF invoice
     */
    async generateInvoice(invoiceId: string): Promise<string> {
        // Fetch invoice details
        const result = await this.pool.query(`
            SELECT 
                si.*,
                g.garage_name, g.cr_number, g.address,
                u.email, u.phone_number
            FROM subscription_invoices si
            JOIN garages g ON si.garage_id = g.garage_id
            JOIN users u ON si.garage_id = u.user_id
            WHERE si.invoice_id = $1
        `, [invoiceId]);

        if (result.rows.length === 0) {
            throw new Error('Invoice not found');
        }

        const invoice = result.rows[0];
        const filename = `${invoice.invoice_number}.pdf`;
        const filepath = path.join(this.invoicesDir, filename);

        // Create PDF
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const writeStream = fs.createWriteStream(filepath);
        doc.pipe(writeStream);

        // Header with logo placeholder
        doc.fontSize(24).font('Helvetica-Bold').text('QScrap', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('كيو سكراب', { align: 'center' });
        doc.moveDown();

        // Invoice title
        doc.fontSize(18).text('TAX INVOICE / فاتورة ضريبية', { align: 'center' });
        doc.moveDown();

        // Invoice details box
        doc.fontSize(10);
        doc.text(`Invoice Number / رقم الفاتورة: ${invoice.invoice_number}`);
        doc.text(`Date / التاريخ: ${new Date(invoice.issued_at).toLocaleDateString('en-QA')}`);
        doc.text(`Status / الحالة: ${invoice.status === 'paid' ? 'PAID / مدفوعة' : 'PENDING / قيد الانتظار'}`);
        doc.moveDown();

        // Divider
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown();

        // From section (QScrap)
        doc.font('Helvetica-Bold').text('From / من:');
        doc.font('Helvetica');
        doc.text('QScrap Technology LLC');
        doc.text('شركة كيو سكراب للتكنولوجيا ذ.م.م');
        doc.text('Doha, Qatar');
        doc.text('CR: 12345678');
        doc.moveDown();

        // To section (Garage)
        doc.font('Helvetica-Bold').text('Bill To / فاتورة إلى:');
        doc.font('Helvetica');
        doc.text(invoice.garage_name);
        doc.text(`CR: ${invoice.cr_number || 'N/A'}`);
        doc.text(`Email: ${invoice.email}`);
        doc.text(`Phone: ${invoice.phone_number}`);
        if (invoice.address) doc.text(`Address: ${invoice.address}`);
        doc.moveDown();

        // Divider
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown();

        // Items table
        doc.font('Helvetica-Bold');
        doc.text('Description', 50, doc.y, { continued: true, width: 300 });
        doc.text('Amount', 450, doc.y, { align: 'right' });
        doc.font('Helvetica');
        doc.moveDown(0.5);

        // Plan line item
        const planDescription = invoice.plan_name || 'Subscription Plan';
        doc.text(planDescription, 50, doc.y, { continued: true, width: 300 });
        doc.text(`${invoice.amount} QAR`, 450, doc.y, { align: 'right' });
        doc.moveDown();

        // Billing period if available
        if (invoice.billing_period_start && invoice.billing_period_end) {
            doc.fontSize(9).text(
                `Period: ${new Date(invoice.billing_period_start).toLocaleDateString()} - ${new Date(invoice.billing_period_end).toLocaleDateString()}`,
                50
            );
            doc.fontSize(10);
        }

        doc.moveDown(2);

        // Totals
        doc.moveTo(350, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold');
        doc.text('Subtotal / المجموع الفرعي:', 350, doc.y, { continued: true });
        doc.text(`${invoice.amount} QAR`, 450, doc.y, { align: 'right' });
        doc.moveDown(0.5);
        doc.text('VAT (0%) / ضريبة القيمة المضافة:', 350, doc.y, { continued: true });
        doc.text('0.00 QAR', 450, doc.y, { align: 'right' });
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text('Total / الإجمالي:', 350, doc.y, { continued: true });
        doc.text(`${invoice.amount} QAR`, 450, doc.y, { align: 'right' });
        doc.fontSize(10).font('Helvetica');
        doc.moveDown(2);

        // Payment info
        if (invoice.status === 'paid') {
            doc.font('Helvetica-Bold').fillColor('green');
            doc.text('✓ PAID', { align: 'center' });
            doc.fillColor('black').font('Helvetica');
            doc.text(`Payment Method: ${invoice.payment_method === 'card' ? 'Credit Card' : 'Bank Transfer'}`, { align: 'center' });
            if (invoice.paid_at) {
                doc.text(`Payment Date: ${new Date(invoice.paid_at).toLocaleDateString('en-QA')}`, { align: 'center' });
            }
            if (invoice.bank_reference) {
                doc.text(`Reference: ${invoice.bank_reference}`, { align: 'center' });
            }
        }

        doc.moveDown(3);

        // Footer
        doc.fontSize(8).fillColor('gray');
        doc.text('This is a computer-generated invoice and does not require a signature.', { align: 'center' });
        doc.text('هذه فاتورة إلكترونية ولا تحتاج إلى توقيع.', { align: 'center' });
        doc.moveDown();
        doc.text('QScrap Technology LLC | www.qscrap.com | support@qscrap.com', { align: 'center' });

        // Finalize
        doc.end();

        // Wait for write to complete
        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // Update invoice record with PDF path
        await this.pool.query(
            'UPDATE subscription_invoices SET pdf_path = $1 WHERE invoice_id = $2',
            [filepath, invoiceId]
        );

        console.log(`[Invoice] Generated PDF: ${filepath}`);

        return filepath;
    }

    /**
     * Get invoice by ID
     */
    async getInvoice(invoiceId: string, garageId?: string) {
        let query = 'SELECT * FROM subscription_invoices WHERE invoice_id = $1';
        const params: any[] = [invoiceId];

        if (garageId) {
            query += ' AND garage_id = $2';
            params.push(garageId);
        }

        const result = await this.pool.query(query, params);
        return result.rows[0];
    }

    /**
     * Get invoices for a garage
     */
    async getGarageInvoices(garageId: string) {
        const result = await this.pool.query(`
            SELECT 
                invoice_id, invoice_number, amount, currency, status,
                plan_name, payment_method, issued_at, paid_at
            FROM subscription_invoices
            WHERE garage_id = $1
            ORDER BY issued_at DESC
            LIMIT 24
        `, [garageId]);

        return result.rows;
    }

    /**
     * Download invoice PDF
     */
    async getInvoicePdf(invoiceId: string, garageId: string): Promise<string | null> {
        const invoice = await this.getInvoice(invoiceId, garageId);

        if (!invoice) {
            throw new Error('Invoice not found');
        }

        // Generate if not exists
        if (!invoice.pdf_path || !fs.existsSync(invoice.pdf_path)) {
            return await this.generateInvoice(invoiceId);
        }

        return invoice.pdf_path;
    }

    /**
     * Create invoice record (called from webhook or service)
     */
    async createInvoice(params: {
        garage_id: string;
        subscription_id?: string;
        request_id?: string;
        amount: number;
        plan_name: string;
        plan_name_ar?: string;
        payment_method: 'card' | 'bank_transfer';
        payment_intent_id?: string;
        bank_reference?: string;
        status?: 'pending' | 'paid';
    }) {
        // Generate invoice number
        const date = new Date();
        const prefix = `QS-INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
        const seqResult = await this.pool.query("SELECT nextval('invoice_number_seq')");
        const invoiceNumber = `${prefix}-${String(seqResult.rows[0].nextval).padStart(4, '0')}`;

        const result = await this.pool.query(`
            INSERT INTO subscription_invoices 
            (invoice_number, garage_id, subscription_id, request_id, amount, plan_name, plan_name_ar, payment_method, payment_intent_id, bank_reference, status, paid_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING invoice_id, invoice_number
        `, [
            invoiceNumber,
            params.garage_id,
            params.subscription_id,
            params.request_id,
            params.amount,
            params.plan_name,
            params.plan_name_ar,
            params.payment_method,
            params.payment_intent_id,
            params.bank_reference,
            params.status || 'paid',
            params.status === 'paid' ? new Date() : null
        ]);

        const invoiceId = result.rows[0].invoice_id;

        // Generate PDF
        try {
            await this.generateInvoice(invoiceId);
        } catch (err) {
            console.error('[Invoice] PDF generation failed:', err);
        }

        return {
            invoice_id: invoiceId,
            invoice_number: invoiceNumber
        };
    }
}
