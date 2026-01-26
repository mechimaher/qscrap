/**
 * Document HTML Template Generators
 * Qatar Ministry of Commerce Compliant - Bilingual Arabic/English
 * PRINT-OPTIMIZED: Single page, minimal ink, BLACK ONLY professional style
 */

import { DocumentData } from '../services/documents/types';
import { COMPANY_INFO } from '../services/documents/bilingual-labels';

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
    vehicle: { en: 'Vehicle', ar: 'المركبة' },
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
    mobile: { en: 'Mobile', ar: 'الجوال' },
};

// ============================================
// CUSTOMER INVOICE - BLACK ONLY PROFESSIONAL
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
        body { font-family: Arial, sans-serif; font-size: 10px; color: #000; line-height: 1.4; }
        .arabic { font-family: 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; }
        .invoice { max-width: 210mm; margin: 0 auto; padding: 12px 18px; }
        
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 2px solid #000; margin-bottom: 10px; }
        .logo-section { display: flex; align-items: center; gap: 8px; }
        .logo-section img { height: 32px; }
        .brand-name { font-size: 18px; font-weight: 700; }
        .title-section { text-align: center; }
        .title-en { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
        .title-ar { font-size: 12px; font-weight: 600; margin-top: 2px; }
        .doc-number { font-size: 9px; color: #333; margin-top: 3px; }
        .date-section { text-align: right; font-size: 9px; color: #333; }
        
        /* Info Grid */
        .info-grid { display: flex; gap: 12px; margin-bottom: 10px; }
        .info-card { flex: 1; border: 1px solid #999; padding: 8px 10px; }
        .info-header { display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; text-transform: uppercase; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }
        .info-name { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
        .info-detail { font-size: 9px; color: #333; margin-bottom: 2px; }
        
        /* Order Badge */
        .order-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 6px 10px; border: 1px solid #999; background: #f9f9f9; }
        .order-label { font-size: 8px; color: #333; text-transform: uppercase; }
        .order-value { font-size: 12px; font-weight: 700; }
        
        /* Item Table */
        .section { margin-bottom: 10px; }
        .section-header { display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; padding: 5px 0; border-bottom: 1px solid #000; margin-bottom: 6px; }
        .item-table { width: 100%; border-collapse: collapse; }
        .item-table th { background: #f0f0f0; padding: 5px 6px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; border: 1px solid #999; }
        .item-table td { padding: 6px; border: 1px solid #ccc; vertical-align: top; }
        .item-name { font-weight: 700; font-size: 10px; }
        .item-meta { font-size: 8px; color: #333; }
        
        /* Totals */
        .totals { width: 200px; margin-left: auto; margin-top: 8px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #ccc; font-size: 9px; }
        .total-row.grand { border: 2px solid #000; padding: 6px 8px; margin-top: 5px; font-weight: 700; font-size: 11px; background: #f0f0f0; }
        
        /* Footer */
        .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid #000; }
        .verify-section { font-size: 8px; color: #333; }
        .verify-code { font-family: monospace; font-weight: 700; font-size: 10px; border: 1px solid #000; padding: 2px 6px; display: inline-block; margin: 3px 0; }
        .qr-code { border: 1px solid #999; padding: 4px; }
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
                <div class="info-detail">Tel: ${data.seller?.phone || 'N/A'}</div>
                <div class="info-detail">${data.seller?.address || 'Qatar'}</div>
                ${data.seller?.cr_number ? `<div class="info-detail">CR: ${data.seller.cr_number}</div>` : ''}
            </div>
            <div class="info-card">
                <div class="info-header"><span>${L.buyer?.en || 'Buyer'}</span><span class="arabic">${L.buyer?.ar || 'المشتري'}</span></div>
                <div class="info-name">${data.buyer?.name || 'N/A'}</div>
                <div class="info-detail"><strong>Mobile:</strong> ${data.buyer?.phone || 'N/A'}</div>
            </div>
        </div>
        
        <div class="order-row">
            <div><span class="order-label">${L.order_number?.en || 'Order'}</span> <span class="arabic" style="margin-left:6px">${L.order_number?.ar || 'رقم الطلب'}</span></div>
            <div class="order-value">${data.order_number}</div>
        </div>
        
        <div class="section">
            <div class="section-header"><span>${L.item_details?.en || 'Item Details'}</span><span class="arabic">${L.item_details?.ar || 'تفاصيل القطعة'}</span></div>
            <table class="item-table">
                <thead><tr>
                    <th style="width:30%">${L.item?.en || 'Item'}<br><span class="arabic" style="font-weight:400;font-size:7px">${L.item?.ar || 'القطعة'}</span></th>
                    <th>${L.vehicle?.en || 'Vehicle'}<br><span class="arabic" style="font-weight:400;font-size:7px">${L.vehicle?.ar || 'المركبة'}</span></th>
                    <th>${L.condition?.en || 'Condition'}<br><span class="arabic" style="font-weight:400;font-size:7px">${L.condition?.ar || 'الحالة'}</span></th>
                    <th>${L.warranty?.en || 'Warranty'}<br><span class="arabic" style="font-weight:400;font-size:7px">${L.warranty?.ar || 'الضمان'}</span></th>
                    <th style="text-align:right">${L.amount?.en || 'Amount'}<br><span class="arabic" style="font-weight:400;font-size:7px">${L.amount?.ar || 'المبلغ'}</span></th>
                </tr></thead>
                <tbody><tr>
                    <td><div class="item-name">${data.item?.part_name || 'Spare Part'}</div></td>
                    <td><div class="item-meta">${data.item?.vehicle || 'N/A'}</div></td>
                    <td>${cond.en} <span class="arabic" style="color:#666">(${cond.ar})</span></td>
                    <td>${data.item?.warranty_days || 30} ${L.days?.en || 'Days'} <span class="arabic" style="color:#666">${L.days?.ar || 'يوم'}</span></td>
                    <td style="text-align:right;font-weight:700">${formatMoney(data.pricing?.part_price || 0)} QAR</td>
                </tr></tbody>
            </table>
            <div class="totals">
                <div class="total-row"><span>${L.part_price?.en || 'Part Price'} <span class="arabic" style="font-size:8px;color:#666">${L.part_price?.ar || 'سعر القطعة'}</span></span><span>${formatMoney(data.pricing?.part_price || 0)} QAR</span></div>
                ${(data.pricing?.delivery_fee || 0) > 0 ? `<div class="total-row"><span>${L.delivery_fee?.en || 'Delivery'} <span class="arabic" style="font-size:8px;color:#666">${L.delivery_fee?.ar || 'التوصيل'}</span></span><span>${formatMoney(data.pricing?.delivery_fee || 0)} QAR</span></div>` : ''}
                ${(data.pricing?.loyalty_discount || 0) > 0 ? `<div class="total-row"><span>Loyalty Discount ${data.pricing?.loyalty_discount_percent || ''}% <span class="arabic" style="font-size:8px;color:#666">خصم الولاء</span></span><span>- ${formatMoney(data.pricing?.loyalty_discount || 0)} QAR</span></div>` : ''}
                <div class="total-row grand"><span>${L.total_paid?.en || 'Total'} <span class="arabic">${L.total_paid?.ar || 'المجموع'}</span></span><span>${formatMoney(data.pricing?.total || 0)} QAR</span></div>
            </div>
        </div>
        
        <!-- Support Contact Section (Always uses current company info) -->
        <div style="margin-top: 12px; padding: 8px 10px; border: 1px solid #999; background: #fafafa;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 9px; font-weight: 700; margin-bottom: 4px;">Need Help? <span class="arabic">تحتاج مساعدة؟</span></div>
                    <div style="font-size: 8px; color: #333;">
                        📞 ${COMPANY_INFO.support_phone} | ✉️ ${COMPANY_INFO.support_email}<br>
                        🌐 ${COMPANY_INFO.website}<br>
                        📍 ${COMPANY_INFO.address.en}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 8px; color: #333;" class="arabic">
                        📍 ${COMPANY_INFO.address.ar}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="verify-section">
                <strong>Verify:</strong> qscrap.qa/verify<br>
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
// GARAGE PAYOUT STATEMENT - BLACK ONLY PROFESSIONAL
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
        body { font-family: Arial, sans-serif; font-size: 10px; color: #000; line-height: 1.4; }
        .arabic { font-family: 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; }
        .invoice { max-width: 210mm; margin: 0 auto; padding: 12px 18px; }
        
        /* Header */
        .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 2px solid #000; margin-bottom: 10px; }
        .logo-section { display: flex; align-items: center; gap: 8px; }
        .logo-section img { height: 32px; }
        .brand-name { font-size: 18px; font-weight: 700; }
        .title-section { text-align: center; }
        .title-en { font-size: 14px; font-weight: 700; letter-spacing: 1px; }
        .title-ar { font-size: 11px; font-weight: 600; margin-top: 2px; }
        .doc-number { font-size: 9px; color: #333; margin-top: 3px; }
        .date-section { text-align: right; font-size: 9px; color: #333; }
        
        /* Info Grid */
        .info-grid { display: flex; gap: 12px; margin-bottom: 10px; }
        .info-card { flex: 1; border: 1px solid #999; padding: 8px 10px; }
        .info-card.highlight { background: #f9f9f9; border: 2px solid #000; }
        .info-header { font-size: 8px; font-weight: 700; text-transform: uppercase; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }
        .info-name { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
        .info-detail { font-size: 9px; color: #333; margin-bottom: 2px; }
        
        /* Section */
        .section { margin-bottom: 10px; }
        .section-header { display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; padding: 5px 0; border-bottom: 1px solid #000; margin-bottom: 6px; }
        .section-content { padding: 8px; border: 1px solid #999; }
        
        /* Item */
        .item-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .item-main { flex: 1; }
        .item-name { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
        .item-meta { font-size: 8px; color: #333; }
        .item-condition { text-align: right; font-size: 9px; }
        .condition-label { font-size: 8px; color: #333; }
        .condition-value { font-weight: 700; }
        
        /* Pricing */
        .pricing { margin-top: 10px; }
        .price-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #ccc; font-size: 10px; }
        .price-row.fee { color: #333; }
        .price-row.payout { border: 2px solid #000; padding: 8px 10px; margin-top: 6px; font-weight: 700; font-size: 12px; background: #f0f0f0; }
        .price-label-ar { font-size: 8px; color: #666; }
        
        /* Footer */
        .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 8px; border-top: 1px solid #000; }
        .footer-info { font-size: 8px; color: #333; line-height: 1.6; }
        .footer-info strong { color: #000; }
        .qr-code { border: 1px solid #999; padding: 4px; }
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
                <div class="info-detail">Tel: ${data.garage?.phone || 'N/A'}</div>
                <div class="info-detail">${data.garage?.address || 'Qatar'}</div>
                ${data.garage?.cr_number && data.garage.cr_number !== 'N/A' ? `<div class="info-detail">CR: ${data.garage.cr_number}</div>` : ''}
            </div>
            <div class="info-card">
                <div class="info-header">${L.platform?.en || 'Platform'} / ${L.platform?.ar || 'المنصة'}</div>
                <div class="info-name">${data.platform?.name || 'QScrap'} <span class="arabic">${data.platform?.name_ar || 'كيو سكراب'}</span></div>
                <div class="info-detail">Order: ${data.customer_ref?.order_number || data.order_number}</div>
                <div class="info-detail">Customer: ${data.customer_ref?.name || 'N/A'}</div>
                <div class="info-detail"><strong>Mobile:</strong> ${data.customer_ref?.phone || 'N/A'}</div>
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
                    <div>${L.your_earnings?.en || 'Your Earnings'} <span class="arabic">${L.your_earnings?.ar || 'أرباحك'}</span></div>
                    <span>${formatMoney(data.pricing?.net_payout || 0)} QAR</span>
                </div>
            </div>
        </div>
        
        <!-- Support Contact Section (Always uses current company info) -->
        <div style="margin-top: 12px; padding: 8px 10px; border: 1px solid #999; background: #fafafa;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 9px; font-weight: 700; margin-bottom: 4px;">Need Help? <span class="arabic">تحتاج مساعدة؟</span></div>
                    <div style="font-size: 8px; color: #333;">
                        📞 ${COMPANY_INFO.support_phone} | ✉️ ${COMPANY_INFO.support_email}<br>
                        🌐 ${COMPANY_INFO.website}<br>
                        📍 ${COMPANY_INFO.address.en}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 8px; color: #333;" class="arabic">
                        📍 ${COMPANY_INFO.address.ar}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-info">
                <strong>Order:</strong> ${data.order_number} | <strong>Status:</strong> ${data.payment?.status || 'Completed'}<br>
                <span style="color:#666">${L.generated_via?.en || 'QScrap Platform'}</span>
            </div>
            <div class="qr-code">${qrCode ? `<img src="${qrCode}" alt="QR">` : ''}</div>
        </div>
    </div>
</body>
</html>`;
}
