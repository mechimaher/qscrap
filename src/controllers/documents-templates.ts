/**
 * Document HTML Template Generators
 * Qatar Ministry of Commerce Compliant - Bilingual Arabic/English
 * PRINT-OPTIMIZED: Single page, minimal ink usage, light lines only
 */

import { DocumentData } from '../services/documents/types';

// ============================================
// BILINGUAL LABELS (ENGLISH / ARABIC)
// Qatar Ministry of Commerce Compliance
// ============================================

const BILINGUAL_LABELS = {
    customer_invoice_title: { en: 'TAX INVOICE', ar: 'فاتورة ضريبية' },
    garage_invoice_title: { en: 'PAYOUT STATEMENT', ar: 'كشف حساب الورشة' },
    seller: { en: 'Seller', ar: 'البائع' },
    buyer: { en: 'Buyer', ar: 'المشتري' },
    platform: { en: 'Platform', ar: 'المنصة' },
    order_number: { en: 'Order Number', ar: 'رقم الطلب' },
    invoice_date: { en: 'Invoice Date', ar: 'تاريخ الفاتورة' },
    statement_date: { en: 'Statement Date', ar: 'تاريخ الكشف' },
    item_details: { en: 'Item Details', ar: 'تفاصيل القطعة' },
    item: { en: 'Item', ar: 'القطعة' },
    condition: { en: 'Condition', ar: 'الحالة' },
    warranty: { en: 'Warranty', ar: 'الضمان' },
    amount: { en: 'Amount', ar: 'المبلغ' },
    delivery_fee: { en: 'Delivery Fee', ar: 'رسوم التوصيل' },
    total_paid: { en: 'Total Paid', ar: 'إجمالي المدفوع' },
    part_price: { en: 'Part Price', ar: 'سعر القطعة' },
    platform_fee: { en: 'Platform Fee', ar: 'رسوم المنصة' },
    your_earnings: { en: 'Your Earnings', ar: 'أرباحك' },
    days: { en: 'Days', ar: 'أيام' },
    verify_at: { en: 'Verify at', ar: 'التحقق عبر' },
    scan_to_verify: { en: 'Scan to verify', ar: 'امسح للتحقق' },
    cr_number: { en: 'CR', ar: 'السجل التجاري' },
    generated_via: { en: 'Generated via QScrap Platform', ar: 'صدرت عبر منصة كيو سكراب' },
    vehicle: { en: 'Vehicle', ar: 'المركبة' },
    category: { en: 'Category', ar: 'الفئة' },
};

// Theme - Print-friendly (light thin lines only, no gold)
const THEME = {
    maroon: '#8D1B3D',
    gray: '#666666',
    lightGray: '#CCCCCC',  // Light thin lines
    border: '#E5E5E5',     // Very light borders
};

// ============================================
// CUSTOMER INVOICE - PRINT OPTIMIZED (Single Page)
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
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a1a; line-height: 1.4; }
        .arabic { font-family: 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; }
        .invoice { max-width: 210mm; margin: 0 auto; padding: 15px 20px; }
        
        /* Header - Light border only */
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid ${THEME.lightGray}; margin-bottom: 10px; }
        .logo-section { display: flex; align-items: center; gap: 8px; }
        .logo-section img { height: 35px; }
        .brand-name { font-size: 18px; font-weight: 700; color: ${THEME.maroon}; }
        .title-section { text-align: center; }
        .title-en { font-size: 16px; font-weight: 700; color: ${THEME.maroon}; letter-spacing: 1px; }
        .title-ar { font-size: 12px; font-weight: 600; color: ${THEME.maroon}; margin-top: 2px; }
        .doc-number { font-size: 9px; color: ${THEME.gray}; margin-top: 3px; }
        .date-section { text-align: right; font-size: 9px; color: ${THEME.gray}; }
        
        /* Info Grid */
        .info-grid { display: flex; gap: 12px; margin-bottom: 10px; }
        .info-card { flex: 1; border: 1px solid ${THEME.border}; padding: 8px 10px; border-radius: 3px; }
        .info-header { display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: ${THEME.maroon}; text-transform: uppercase; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid ${THEME.border}; }
        .info-name { font-size: 10px; font-weight: 700; margin-bottom: 2px; }
        .info-detail { font-size: 9px; color: ${THEME.gray}; margin-bottom: 1px; }
        
        /* Order Badge */
        .order-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 6px 10px; border: 1px solid ${THEME.border}; border-radius: 3px; }
        .order-label { font-size: 8px; color: ${THEME.gray}; text-transform: uppercase; }
        .order-value { font-size: 11px; font-weight: 700; color: ${THEME.maroon}; }
        
        /* Item Table */
        .section { margin-bottom: 10px; }
        .section-header { display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: ${THEME.maroon}; padding: 5px 0; border-bottom: 1px solid ${THEME.lightGray}; margin-bottom: 6px; }
        .item-table { width: 100%; border-collapse: collapse; }
        .item-table th { background: #fafafa; padding: 5px 6px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid ${THEME.border}; }
        .item-table td { padding: 6px; border-bottom: 1px solid ${THEME.border}; vertical-align: top; }
        .item-name { font-weight: 700; font-size: 10px; }
        .item-meta { font-size: 8px; color: ${THEME.gray}; }
        
        /* Totals */
        .totals { width: 200px; margin-left: auto; margin-top: 8px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid ${THEME.border}; font-size: 9px; }
        .total-row.grand { border: 1px solid ${THEME.lightGray}; padding: 6px 8px; margin-top: 5px; font-weight: 700; font-size: 11px; border-radius: 3px; }
        .total-row.grand .label { color: ${THEME.maroon}; }
        
        /* Footer */
        .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid ${THEME.lightGray}; }
        .verify-section { font-size: 8px; color: ${THEME.gray}; }
        .verify-code { font-family: monospace; font-weight: 700; color: ${THEME.maroon}; font-size: 10px; border: 1px solid ${THEME.lightGray}; padding: 2px 6px; display: inline-block; margin: 3px 0; }
        .qr-code { border: 1px solid ${THEME.lightGray}; padding: 4px; border-radius: 3px; }
        .qr-code img { width: 55px; height: 55px; }
        
        @media print { body { -webkit-print-color-adjust: exact; } .invoice { padding: 8px 12px; } }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="logo-section">
                ${logoBase64 ? `<img src="${logoBase64}" alt="QScrap">` : ''}
                <span class="brand-name">QSCRAP</span>
            </div>
            <div class="title-section">
                <div class="title-en">${L.customer_invoice_title?.en || 'TAX INVOICE'}</div>
                <div class="title-ar arabic">${L.customer_invoice_title?.ar || 'فاتورة ضريبية'}</div>
                <div class="doc-number">${data.invoice_number}</div>
            </div>
            <div class="date-section">
                <div>${formatDate(data.invoice_date || '')}</div>
                <div class="arabic">${L.invoice_date?.ar || 'تاريخ الفاتورة'}</div>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-card">
                <div class="info-header"><span>${L.seller?.en || 'Seller'}</span><span class="arabic">${L.seller?.ar || 'البائع'}</span></div>
                <div class="info-name">${data.seller?.name || 'N/A'}</div>
                <div class="info-detail">📞 ${data.seller?.phone || 'N/A'}</div>
                <div class="info-detail">📍 ${data.seller?.address || 'Qatar'}</div>
                ${data.seller?.cr_number ? `<div class="info-detail">CR: ${data.seller.cr_number}</div>` : ''}
            </div>
            <div class="info-card">
                <div class="info-header"><span>${L.buyer?.en || 'Buyer'}</span><span class="arabic">${L.buyer?.ar || 'المشتري'}</span></div>
                <div class="info-name">${data.buyer?.name || 'N/A'}</div>
                <div class="info-detail">📞 ${data.buyer?.phone || 'N/A'}</div>
                <div class="info-detail">📍 ${data.buyer?.address || 'N/A'}</div>
            </div>
        </div>
        
        <div class="order-row">
            <div><span class="order-label">${L.order_number?.en || 'Order'}</span> <span class="arabic" style="margin-left:6px">${L.order_number?.ar || 'رقم الطلب'}</span></div>
            <div class="order-value">${data.order_number}</div>
        </div>
        
        <div class="section">
            <div class="section-header"><span>${L.item_details?.en || 'Item Details'}</span><span class="arabic">${L.item_details?.ar || 'تفاصيل القطعة'}</span></div>
            <table class="item-table">
                <thead><tr><th style="width:40%">${L.item?.en || 'Item'}</th><th>Vehicle</th><th>${L.condition?.en || 'Condition'}</th><th>${L.warranty?.en || 'Warranty'}</th><th style="text-align:right">${L.amount?.en || 'Amount'}</th></tr></thead>
                <tbody><tr>
                    <td><div class="item-name">${data.item?.part_name || 'Spare Part'}</div></td>
                    <td><div class="item-meta">${data.item?.vehicle || 'N/A'}</div></td>
                    <td>${cond.en} <span class="arabic" style="color:#888">(${cond.ar})</span></td>
                    <td>${data.item?.warranty_days || 30} ${L.days?.en || 'Days'}</td>
                    <td style="text-align:right;font-weight:700">${formatMoney(data.pricing?.part_price || 0)} QAR</td>
                </tr></tbody>
            </table>
            <div class="totals">
                <div class="total-row"><span>${L.part_price?.en || 'Part Price'}</span><span>${formatMoney(data.pricing?.part_price || 0)} QAR</span></div>
                ${(data.pricing?.delivery_fee || 0) > 0 ? `<div class="total-row"><span>${L.delivery_fee?.en || 'Delivery'}</span><span>${formatMoney(data.pricing?.delivery_fee || 0)} QAR</span></div>` : ''}
                <div class="total-row grand"><span class="label">${L.total_paid?.en || 'Total'} <span class="arabic">${L.total_paid?.ar || 'المجموع'}</span></span><span>${formatMoney(data.pricing?.total || 0)} QAR</span></div>
            </div>
        </div>
        
        <div class="footer">
            <div class="verify-section">
                <strong>${L.verify_at?.en || 'Verify'}:</strong> qscrap.qa/verify<br>
                <span class="verify-code">${data.verification?.code || 'N/A'}</span><br>
                <span>${L.generated_via?.en || 'QScrap Platform'} • ${formatDate(data.invoice_date || '')}</span>
            </div>
            <div class="qr-code">${qrCode ? `<img src="${qrCode}" alt="QR">` : ''}</div>
        </div>
    </div>
</body>
</html>`;
}

// ============================================
// GARAGE PAYOUT STATEMENT - PRINT OPTIMIZED
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
    <title>Payout ${data.invoice_number}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a1a; line-height: 1.4; }
        .arabic { font-family: 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; }
        .invoice { max-width: 210mm; margin: 0 auto; padding: 15px 20px; }
        
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid ${THEME.lightGray}; margin-bottom: 10px; }
        .logo-section { display: flex; align-items: center; gap: 8px; }
        .logo-section img { height: 35px; }
        .brand-name { font-size: 18px; font-weight: 700; color: ${THEME.maroon}; }
        .title-section { text-align: center; }
        .title-en { font-size: 14px; font-weight: 700; color: ${THEME.maroon}; letter-spacing: 1px; }
        .title-ar { font-size: 11px; font-weight: 600; color: ${THEME.maroon}; margin-top: 2px; }
        .doc-number { font-size: 9px; color: ${THEME.gray}; margin-top: 3px; }
        .date-section { text-align: right; font-size: 9px; color: ${THEME.gray}; }
        
        /* Info Grid */
        .info-grid { display: flex; gap: 12px; margin-bottom: 10px; }
        .info-card { flex: 1; border: 1px solid ${THEME.border}; padding: 8px 10px; border-radius: 3px; }
        .info-card.highlight { border: 1px solid ${THEME.lightGray}; background: #fafafa; }
        .info-header { font-size: 8px; font-weight: 700; color: ${THEME.maroon}; text-transform: uppercase; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid ${THEME.border}; }
        .info-name { font-size: 10px; font-weight: 700; margin-bottom: 2px; }
        .info-detail { font-size: 9px; color: ${THEME.gray}; margin-bottom: 1px; }
        
        /* Section */
        .section { margin-bottom: 10px; }
        .section-header { display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: ${THEME.maroon}; padding: 5px 0; border-bottom: 1px solid ${THEME.lightGray}; margin-bottom: 6px; }
        .section-content { padding: 8px; border: 1px solid ${THEME.border}; border-radius: 3px; }
        
        /* Item */
        .item-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .item-main { flex: 1; }
        .item-name { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
        .item-meta { font-size: 8px; color: ${THEME.gray}; }
        .item-condition { text-align: right; font-size: 9px; }
        .condition-label { font-size: 8px; color: ${THEME.gray}; }
        .condition-value { font-weight: 700; color: ${THEME.maroon}; }
        
        /* Pricing */
        .pricing { margin-top: 10px; }
        .price-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid ${THEME.border}; font-size: 10px; }
        .price-row.fee { color: #dc2626; }
        .price-row.payout { border: 1px solid ${THEME.lightGray}; padding: 8px 10px; margin-top: 6px; font-weight: 700; font-size: 12px; border-radius: 3px; background: #fafafa; }
        .price-row.payout .label { color: ${THEME.maroon}; }
        .price-label-ar { font-size: 8px; color: ${THEME.gray}; }
        
        /* Footer */
        .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid ${THEME.lightGray}; }
        .footer-info { font-size: 8px; color: ${THEME.gray}; line-height: 1.6; }
        .footer-info strong { color: ${THEME.maroon}; }
        .qr-code { border: 1px solid ${THEME.lightGray}; padding: 4px; border-radius: 3px; }
        .qr-code img { width: 55px; height: 55px; }
        
        @media print { body { -webkit-print-color-adjust: exact; } .invoice { padding: 8px 12px; } }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="logo-section">
                ${logoBase64 ? `<img src="${logoBase64}" alt="QScrap">` : ''}
                <span class="brand-name">QSCRAP</span>
            </div>
            <div class="title-section">
                <div class="title-en">${L.garage_invoice_title?.en || 'PAYOUT STATEMENT'}</div>
                <div class="title-ar arabic">${L.garage_invoice_title?.ar || 'كشف حساب الورشة'}</div>
                <div class="doc-number">${data.invoice_number}</div>
            </div>
            <div class="date-section">
                <div>${formatDate(data.invoice_date || '')}</div>
                <div class="arabic">${L.statement_date?.ar || 'تاريخ الكشف'}</div>
            </div>
        </div>
        
        <div class="info-grid">
            <div class="info-card highlight">
                <div class="info-header">GARAGE / الورشة</div>
                <div class="info-name">${data.garage?.name || 'N/A'}</div>
                <div class="info-detail">📞 ${data.garage?.phone || 'N/A'}</div>
                <div class="info-detail">📍 ${data.garage?.address || 'Qatar'}</div>
                ${data.garage?.cr_number && data.garage.cr_number !== 'N/A' ? `<div class="info-detail">CR: ${data.garage.cr_number}</div>` : ''}
            </div>
            <div class="info-card">
                <div class="info-header">${L.platform?.en || 'Platform'} / ${L.platform?.ar || 'المنصة'}</div>
                <div class="info-name">${data.platform?.name || 'QScrap'} <span class="arabic">${data.platform?.name_ar || 'كيو سكراب'}</span></div>
                <div class="info-detail">Order: ${data.customer_ref?.order_number || data.order_number}</div>
                <div class="info-detail">Customer: ${data.customer_ref?.name || 'N/A'}</div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-header"><span>${L.item_details?.en || 'Item Details'}</span><span class="arabic">${L.item_details?.ar || 'تفاصيل القطعة'}</span></div>
            <div class="section-content">
                <div class="item-row">
                    <div class="item-main">
                        <div class="item-name">${data.item?.part_name || 'Spare Part'}</div>
                        <div class="item-meta">Vehicle: ${data.item?.vehicle || 'N/A'}</div>
                    </div>
                    <div class="item-condition">
                        <div class="condition-label">${L.condition?.en || 'Condition'}</div>
                        <div class="condition-value">${cond.en}</div>
                        <div class="arabic" style="font-size:8px;color:#666">${cond.ar}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-header"><span>PAYOUT BREAKDOWN</span><span class="arabic">تفاصيل المستحقات</span></div>
            <div class="pricing">
                <div class="price-row">
                    <div><span>${L.part_price?.en || 'Part Price'}</span> <span class="price-label-ar arabic">${L.part_price?.ar || 'سعر القطعة'}</span></div>
                    <span style="font-weight:600">${formatMoney(data.pricing?.part_price || 0)} QAR</span>
                </div>
                <div class="price-row fee">
                    <div><span>${L.platform_fee?.en || 'Platform Fee'} (${data.pricing?.commission_rate_percent || '15%'})</span> <span class="price-label-ar arabic">${L.platform_fee?.ar || 'رسوم المنصة'}</span></div>
                    <span style="font-weight:600">- ${formatMoney(data.pricing?.platform_fee || 0)} QAR</span>
                </div>
                <div class="price-row payout">
                    <div class="label">${L.your_earnings?.en || 'Your Earnings'} <span class="arabic">${L.your_earnings?.ar || 'أرباحك'}</span></div>
                    <span>${formatMoney(data.pricing?.net_payout || 0)} QAR</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-info">
                <strong>Order:</strong> ${data.order_number} | <strong>Status:</strong> ${data.payment?.status || 'Completed'}<br>
                <span style="color:#999">${L.generated_via?.en || 'QScrap Platform'}</span>
            </div>
            <div class="qr-code">${qrCode ? `<img src="${qrCode}" alt="QR">` : ''}</div>
        </div>
    </div>
</body>
</html>`;
}
