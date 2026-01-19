/**
 * Document HTML Template Generators
 * Qatar Ministry of Commerce Compliant - Bilingual Arabic/English
 * Restored from git history after refactoring
 */

import { DocumentData } from '../services/documents/types';

// ============================================
// BILINGUAL LABELS (ENGLISH / ARABIC)
// Qatar Ministry of Commerce Compliance
// ============================================

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
    generated_via: { en: 'Generated via QScrap Platform', ar: 'صدرت عبر منصة كيو سكراب' },
    customer_info: { en: 'Customer', ar: 'العميل' },
};

// ============================================
// BILINGUAL CUSTOMER INVOICE TEMPLATE (B2C)
// Arabic + English, Qatar MoC Compliant
// ============================================
export function generateBilingualCustomerInvoiceHTML(
    data: DocumentData,
    qrCode: string,
    logoBase64: string = ''
): string {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const formatMoney = (n: number) => n.toLocaleString('en-QA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const L = data.labels || BILINGUAL_LABELS;
    const cond = data.item?.condition || { en: 'N/A', ar: 'غير محدد' };

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice ${data.invoice_number}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.4; }
        .arabic { font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif; direction: rtl; }
        .invoice { max-width: 800px; margin: 0 auto; padding: 25px; background: white; }
        
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #1a1a1a; }
        .logo { font-size: 28px; font-weight: 700; color: #1a1a1a; }
        .title-block { text-align: center; }
        .title-en { font-size: 20px; font-weight: 700; letter-spacing: 3px; }
        .title-ar { font-size: 18px; font-weight: 600; margin-top: 4px; }
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
export function generateGaragePayoutStatementHTML(
    data: DocumentData,
    qrCode: string,
    logoBase64: string = ''
): string {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const formatMoney = (n: number) => n.toLocaleString('en-QA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const L = data.labels || BILINGUAL_LABELS;
    const cond = data.item?.condition || { en: 'N/A', ar: 'غير محدد' };

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Payout Statement ${data.invoice_number}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.4; }
        .arabic { font-family: 'Noto Sans Arabic', 'Segoe UI', sans-serif; direction: rtl; }
        .invoice { max-width: 800px; margin: 0 auto; padding: 25px; background: white; }
        
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; padding-bottom: 15px; border-bottom: 3px solid #1a56db; }
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
