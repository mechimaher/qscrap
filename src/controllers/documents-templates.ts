/**
 * Document HTML Template Generators
 * Qatar Ministry of Commerce Compliant - Bilingual Arabic/English
 * PREMIUM EDITION - Qatar Maroon & Gold Theme
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

// Qatar Premium Theme Colors
const THEME = {
    maroon: '#8D1B3D',
    maroonDark: '#6B1530',
    maroonLight: '#F5E6EB',
    gold: '#C9A227',
    goldLight: '#F5F0E1',
    white: '#FFFFFF',
    gray: '#6A6A6A',
    grayLight: '#F8F8F8',
};

// ============================================
// PREMIUM CUSTOMER INVOICE TEMPLATE (B2C)
// Qatar Maroon & Gold Theme
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
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@500;600;700&family=Noto+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: 'Inter', sans-serif; 
            font-size: 11px; 
            color: #1a1a1a; 
            line-height: 1.5;
            background: ${THEME.grayLight};
        }
        
        .arabic { 
            font-family: 'Noto Sans Arabic', 'Noto Kufi Arabic', sans-serif; 
            direction: rtl; 
        }
        
        .invoice { 
            max-width: 800px; 
            margin: 0 auto; 
            background: ${THEME.white}; 
            box-shadow: 0 4px 24px rgba(0,0,0,0.1);
        }
        
        /* ===== PREMIUM HEADER ===== */
        .header {
            background: linear-gradient(135deg, ${THEME.maroon} 0%, ${THEME.maroonDark} 100%);
            color: white;
            padding: 28px 35px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 5px solid ${THEME.gold};
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .logo-section img {
            height: 55px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(201, 162, 39, 0.4);
        }
        
        .brand-name {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 2px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .title-section {
            text-align: center;
        }
        
        .title-en {
            font-family: 'Playfair Display', serif;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 4px;
            margin-bottom: 4px;
        }
        
        .title-ar {
            font-family: 'Noto Kufi Arabic', sans-serif;
            font-size: 20px;
            font-weight: 600;
            opacity: 0.95;
        }
        
        .doc-number {
            background: ${THEME.gold};
            color: ${THEME.maroonDark};
            font-size: 11px;
            font-weight: 700;
            padding: 6px 14px;
            border-radius: 20px;
            margin-top: 10px;
            display: inline-block;
            letter-spacing: 1px;
        }
        
        .date-section {
            text-align: right;
            background: rgba(255,255,255,0.1);
            padding: 12px 18px;
            border-radius: 8px;
        }
        
        .date-section .date-en {
            font-size: 14px;
            font-weight: 600;
        }
        
        .date-section .date-ar {
            font-size: 11px;
            opacity: 0.85;
            margin-top: 2px;
        }
        
        /* ===== CONTENT AREA ===== */
        .content {
            padding: 30px 35px;
        }
        
        /* ===== INFO CARDS ===== */
        .info-grid {
            display: flex;
            gap: 20px;
            margin-bottom: 25px;
        }
        
        .info-card {
            flex: 1;
            background: ${THEME.maroonLight};
            border-left: 4px solid ${THEME.gold};
            border-radius: 0 10px 10px 0;
            padding: 18px 20px;
            box-shadow: 0 2px 8px rgba(141, 27, 61, 0.08);
        }
        
        .info-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 10px;
            margin-bottom: 12px;
            border-bottom: 1px solid rgba(141, 27, 61, 0.1);
        }
        
        .info-label-en {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: ${THEME.maroon};
        }
        
        .info-label-ar {
            font-size: 11px;
            font-weight: 600;
            color: ${THEME.maroon};
        }
        
        .info-name {
            font-size: 15px;
            font-weight: 700;
            color: ${THEME.maroonDark};
            margin-bottom: 6px;
        }
        
        .info-detail {
            font-size: 11px;
            color: ${THEME.gray};
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        /* ===== ORDER NUMBER BADGE ===== */
        .order-badge-container {
            margin-bottom: 25px;
        }
        
        .order-badge {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            background: linear-gradient(135deg, ${THEME.goldLight} 0%, ${THEME.white} 100%);
            border: 2px solid ${THEME.gold};
            border-radius: 10px;
            padding: 12px 20px;
        }
        
        .order-badge-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: ${THEME.gray};
        }
        
        .order-badge-value {
            font-size: 16px;
            font-weight: 700;
            color: ${THEME.maroon};
            font-family: 'Inter', monospace;
        }
        
        /* ===== ITEM DETAILS SECTION ===== */
        .section {
            background: ${THEME.white};
            border: 2px solid ${THEME.maroonLight};
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 25px;
        }
        
        .section-header {
            background: linear-gradient(135deg, ${THEME.maroon} 0%, ${THEME.maroonDark} 100%);
            color: white;
            padding: 14px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .section-header span {
            font-weight: 600;
            font-size: 12px;
            letter-spacing: 0.5px;
        }
        
        .section-content {
            padding: 20px;
        }
        
        /* ===== ITEM TABLE ===== */
        .item-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .item-table thead th {
            background: ${THEME.maroonLight};
            color: ${THEME.maroon};
            padding: 12px 15px;
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid ${THEME.gold};
        }
        
        .item-table tbody td {
            padding: 16px 15px;
            border-bottom: 1px solid ${THEME.maroonLight};
            vertical-align: top;
        }
        
        .item-table tbody tr:nth-child(even) {
            background: ${THEME.goldLight};
        }
        
        .item-name {
            font-weight: 700;
            font-size: 13px;
            color: ${THEME.maroonDark};
            margin-bottom: 4px;
        }
        
        .item-meta {
            font-size: 10px;
            color: ${THEME.gray};
            line-height: 1.6;
        }
        
        .item-amount {
            font-size: 15px;
            font-weight: 700;
            color: ${THEME.maroon};
            text-align: right;
        }
        
        /* ===== TOTALS ===== */
        .totals {
            width: 320px;
            margin-left: auto;
            margin-top: 20px;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid ${THEME.maroonLight};
        }
        
        .total-label {
            font-size: 12px;
            color: ${THEME.gray};
        }
        
        .total-label .arabic {
            font-size: 10px;
            color: #999;
            margin-left: 6px;
        }
        
        .total-value {
            font-size: 13px;
            font-weight: 600;
            color: ${THEME.maroonDark};
        }
        
        .total-row.grand {
            background: linear-gradient(135deg, ${THEME.gold} 0%, #D4AF37 100%);
            color: ${THEME.maroonDark};
            margin-top: 12px;
            padding: 16px 20px;
            border-radius: 10px;
            border: none;
            box-shadow: 0 4px 12px rgba(201, 162, 39, 0.3);
        }
        
        .total-row.grand .total-label {
            font-size: 14px;
            font-weight: 700;
            color: ${THEME.maroonDark};
        }
        
        .total-row.grand .total-value {
            font-size: 18px;
            font-weight: 800;
            color: ${THEME.maroonDark};
        }
        
        /* ===== FOOTER ===== */
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 30px;
            padding-top: 25px;
            border-top: 3px solid ${THEME.maroon};
        }
        
        .verify-section {
            max-width: 300px;
        }
        
        .verify-title {
            font-size: 11px;
            font-weight: 700;
            color: ${THEME.maroon};
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .verify-code {
            font-family: 'Inter', monospace;
            font-size: 14px;
            font-weight: 700;
            background: ${THEME.maroonLight};
            color: ${THEME.maroon};
            padding: 8px 16px;
            border-radius: 6px;
            border: 1px solid ${THEME.maroon};
            display: inline-block;
            margin-bottom: 12px;
        }
        
        .verify-footer {
            font-size: 9px;
            color: ${THEME.gray};
        }
        
        .qr-section {
            text-align: center;
        }
        
        .qr-code {
            padding: 10px;
            background: white;
            border: 3px solid ${THEME.gold};
            border-radius: 12px;
            display: inline-block;
            box-shadow: 0 4px 12px rgba(201, 162, 39, 0.2);
        }
        
        .qr-code img {
            width: 100px;
            height: 100px;
        }
        
        .qr-label {
            font-size: 9px;
            color: ${THEME.gray};
            margin-top: 8px;
        }
        
        @media print {
            body { background: white; }
            .invoice { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="invoice">
        <!-- Premium Header -->
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
                <div class="date-en">${formatDate(data.invoice_date || '')}</div>
                <div class="date-ar arabic">${L.invoice_date?.ar || 'تاريخ الفاتورة'}</div>
            </div>
        </div>
        
        <div class="content">
            <!-- Seller & Buyer Info -->
            <div class="info-grid">
                <div class="info-card">
                    <div class="info-header">
                        <span class="info-label-en">${L.seller?.en || 'Seller'}</span>
                        <span class="info-label-ar arabic">${L.seller?.ar || 'البائع'}</span>
                    </div>
                    <div class="info-name">${data.seller?.name || 'N/A'}</div>
                    <div class="info-detail">📞 ${data.seller?.phone || 'N/A'}</div>
                    <div class="info-detail">📍 ${data.seller?.address || 'Qatar'}</div>
                    ${data.seller?.cr_number ? `<div class="info-detail">🏢 ${L.cr_number?.en || 'CR'}: ${data.seller.cr_number}</div>` : ''}
                </div>
                <div class="info-card">
                    <div class="info-header">
                        <span class="info-label-en">${L.buyer?.en || 'Buyer'}</span>
                        <span class="info-label-ar arabic">${L.buyer?.ar || 'المشتري'}</span>
                    </div>
                    <div class="info-name">${data.buyer?.name || 'N/A'}</div>
                    <div class="info-detail">📞 ${data.buyer?.phone || 'N/A'}</div>
                    <div class="info-detail">📍 ${data.buyer?.address || 'N/A'}</div>
                </div>
            </div>
            
            <!-- Order Badge -->
            <div class="order-badge-container">
                <div class="order-badge">
                    <div>
                        <div class="order-badge-label">${L.order_number?.en || 'Order Number'}</div>
                        <div class="order-badge-value">${data.order_number}</div>
                    </div>
                    <div class="arabic" style="text-align: right;">
                        <div class="order-badge-label">${L.order_number?.ar || 'رقم الطلب'}</div>
                    </div>
                </div>
            </div>
            
            <!-- Item Details -->
            <div class="section">
                <div class="section-header">
                    <span>${L.item_details?.en || 'Item Details'}</span>
                    <span class="arabic">${L.item_details?.ar || 'تفاصيل القطعة'}</span>
                </div>
                <div class="section-content">
                    <table class="item-table">
                        <thead>
                            <tr>
                                <th style="width: 45%">${L.item?.en || 'Item'}</th>
                                <th>${L.condition?.en || 'Condition'}</th>
                                <th>${L.warranty?.en || 'Warranty'}</th>
                                <th style="text-align: right">${L.amount?.en || 'Amount'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <div class="item-name">${data.item?.part_name || 'Auto Part'}</div>
                                    <div class="item-meta">
                                        Vehicle: ${data.item?.vehicle || 'N/A'}<br>
                                        Part #: ${data.item?.part_number || 'N/A'}
                                    </div>
                                </td>
                                <td>
                                    ${cond.en}<br>
                                    <span class="arabic" style="color: #888; font-size: 10px;">${cond.ar}</span>
                                </td>
                                <td>${data.item?.warranty_days || 30} ${L.days?.en || 'Days'}</td>
                                <td class="item-amount">${formatMoney(data.pricing?.part_price || 0)} QAR</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <!-- Totals -->
                    <div class="totals">
                        <div class="total-row">
                            <span class="total-label">${L.part_price?.en || 'Part Price'} <span class="arabic">${L.part_price?.ar || 'سعر القطعة'}</span></span>
                            <span class="total-value">${formatMoney(data.pricing?.part_price || 0)} QAR</span>
                        </div>
                        ${(data.pricing?.delivery_fee || 0) > 0 ? `
                        <div class="total-row">
                            <span class="total-label">${L.delivery_fee?.en || 'Delivery Fee'} <span class="arabic">${L.delivery_fee?.ar || 'رسوم التوصيل'}</span></span>
                            <span class="total-value">${formatMoney(data.pricing?.delivery_fee || 0)} QAR</span>
                        </div>` : ''}
                        <div class="total-row grand">
                            <span class="total-label">${L.total_paid?.en || 'Total Paid'} <span class="arabic">${L.total_paid?.ar || 'إجمالي المدفوع'}</span></span>
                            <span class="total-value">${formatMoney(data.pricing?.total || 0)} QAR</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <div class="verify-section">
                    <div class="verify-title">${L.verify_at?.en || 'Verify at'}: qscrap.qa/verify</div>
                    <div class="verify-code">${data.verification?.code || 'N/A'}</div>
                    <div class="verify-footer">${L.generated_via?.en || 'Generated via QScrap Platform'} • ${formatDate(data.invoice_date || '')}</div>
                </div>
                <div class="qr-section">
                    <div class="qr-code">
                        ${qrCode ? `<img src="${qrCode}" alt="QR Code">` : ''}
                    </div>
                    <div class="qr-label">${L.scan_to_verify?.en || 'Scan to verify'} / ${L.scan_to_verify?.ar || 'امسح للتحقق'}</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// ============================================
// PREMIUM GARAGE PAYOUT STATEMENT (B2B)
// Qatar Maroon & Gold Theme
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
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@500;600;700&family=Noto+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: 'Inter', sans-serif; 
            font-size: 11px; 
            color: #1a1a1a; 
            line-height: 1.5;
            background: ${THEME.grayLight};
        }
        
        .arabic { 
            font-family: 'Noto Sans Arabic', 'Noto Kufi Arabic', sans-serif; 
            direction: rtl; 
        }
        
        .invoice { 
            max-width: 800px; 
            margin: 0 auto; 
            background: ${THEME.white}; 
            box-shadow: 0 4px 24px rgba(0,0,0,0.1);
        }
        
        /* ===== PREMIUM HEADER ===== */
        .header {
            background: linear-gradient(135deg, ${THEME.maroon} 0%, ${THEME.maroonDark} 100%);
            color: white;
            padding: 28px 35px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 5px solid ${THEME.gold};
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .logo-section img {
            height: 55px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(201, 162, 39, 0.4);
        }
        
        .brand-name {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 2px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .title-section {
            text-align: center;
        }
        
        .title-en {
            font-family: 'Playfair Display', serif;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: 3px;
            margin-bottom: 4px;
        }
        
        .title-ar {
            font-family: 'Noto Kufi Arabic', sans-serif;
            font-size: 18px;
            font-weight: 600;
            opacity: 0.95;
        }
        
        .doc-number {
            background: ${THEME.gold};
            color: ${THEME.maroonDark};
            font-size: 11px;
            font-weight: 700;
            padding: 6px 14px;
            border-radius: 20px;
            margin-top: 10px;
            display: inline-block;
            letter-spacing: 1px;
        }
        
        .date-section {
            text-align: right;
            background: rgba(255,255,255,0.1);
            padding: 12px 18px;
            border-radius: 8px;
        }
        
        .date-section .date-en {
            font-size: 14px;
            font-weight: 600;
        }
        
        .date-section .date-ar {
            font-size: 11px;
            opacity: 0.85;
            margin-top: 2px;
        }
        
        /* ===== CONTENT AREA ===== */
        .content {
            padding: 30px 35px;
        }
        
        /* ===== INFO CARDS ===== */
        .info-grid {
            display: flex;
            gap: 20px;
            margin-bottom: 25px;
        }
        
        .info-card {
            flex: 1;
            background: ${THEME.maroonLight};
            border-left: 4px solid ${THEME.gold};
            border-radius: 0 10px 10px 0;
            padding: 18px 20px;
            box-shadow: 0 2px 8px rgba(141, 27, 61, 0.08);
        }
        
        .info-card.highlight {
            background: linear-gradient(135deg, ${THEME.goldLight} 0%, ${THEME.white} 100%);
            border-left-color: ${THEME.maroon};
            border: 2px solid ${THEME.gold};
            border-left: 4px solid ${THEME.maroon};
        }
        
        .info-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 10px;
            margin-bottom: 12px;
            border-bottom: 1px solid rgba(141, 27, 61, 0.1);
        }
        
        .info-label-en {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: ${THEME.maroon};
        }
        
        .info-name {
            font-size: 15px;
            font-weight: 700;
            color: ${THEME.maroonDark};
            margin-bottom: 6px;
        }
        
        .info-detail {
            font-size: 11px;
            color: ${THEME.gray};
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        /* ===== SECTION ===== */
        .section {
            background: ${THEME.white};
            border: 2px solid ${THEME.maroonLight};
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 25px;
        }
        
        .section-header {
            background: linear-gradient(135deg, ${THEME.maroon} 0%, ${THEME.maroonDark} 100%);
            color: white;
            padding: 14px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .section-header span {
            font-weight: 600;
            font-size: 12px;
            letter-spacing: 0.5px;
        }
        
        .section-content {
            padding: 20px;
        }
        
        /* ===== ITEM META ===== */
        .item-meta-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        
        .item-main {
            flex: 1;
        }
        
        .item-name {
            font-size: 16px;
            font-weight: 700;
            color: ${THEME.maroonDark};
            margin-bottom: 8px;
        }
        
        .item-details {
            font-size: 11px;
            color: ${THEME.gray};
            line-height: 1.8;
        }
        
        .item-condition {
            text-align: right;
            background: ${THEME.maroonLight};
            padding: 12px 18px;
            border-radius: 8px;
        }
        
        .condition-label {
            font-size: 10px;
            color: ${THEME.gray};
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        
        .condition-value {
            font-weight: 700;
            color: ${THEME.maroon};
        }
        
        /* ===== PAYOUT BREAKDOWN ===== */
        .pricing-breakdown {
            background: ${THEME.grayLight};
            border-radius: 10px;
            padding: 20px;
        }
        
        .price-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid ${THEME.maroonLight};
        }
        
        .price-row:last-child { border-bottom: none; }
        
        .price-label {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .price-label-en {
            font-size: 13px;
            font-weight: 500;
            color: #333;
        }
        
        .price-label-ar {
            font-size: 10px;
            color: ${THEME.gray};
        }
        
        .price-value {
            font-size: 14px;
            font-weight: 700;
            color: ${THEME.maroonDark};
        }
        
        .price-row.fee .price-value {
            color: #dc2626;
        }
        
        .price-row.payout {
            background: linear-gradient(135deg, ${THEME.gold} 0%, #D4AF37 100%);
            margin: 16px -20px -20px;
            padding: 20px 24px;
            border-radius: 0 0 10px 10px;
            border: none;
        }
        
        .price-row.payout .price-label-en {
            font-size: 15px;
            font-weight: 700;
            color: ${THEME.maroonDark};
        }
        
        .price-row.payout .price-label-ar {
            font-size: 12px;
            color: ${THEME.maroonDark};
            opacity: 0.8;
        }
        
        .price-row.payout .price-value {
            font-size: 22px;
            font-weight: 800;
            color: ${THEME.maroonDark};
        }
        
        /* ===== FOOTER ===== */
        .footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 30px;
            padding-top: 25px;
            border-top: 3px solid ${THEME.maroon};
        }
        
        .footer-info {
            font-size: 10px;
            color: ${THEME.gray};
            line-height: 2;
        }
        
        .footer-info strong {
            color: ${THEME.maroon};
        }
        
        .footer-tagline {
            margin-top: 12px;
            font-size: 9px;
            color: #999;
        }
        
        .qr-section {
            text-align: center;
        }
        
        .qr-code {
            padding: 8px;
            background: white;
            border: 3px solid ${THEME.gold};
            border-radius: 10px;
            display: inline-block;
            box-shadow: 0 4px 12px rgba(201, 162, 39, 0.2);
        }
        
        .qr-code img {
            width: 90px;
            height: 90px;
        }
        
        .qr-label {
            font-size: 9px;
            color: ${THEME.gray};
            margin-top: 8px;
        }
        
        @media print {
            body { background: white; }
            .invoice { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="invoice">
        <!-- Premium Header -->
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
                <div class="date-en">${formatDate(data.invoice_date || '')}</div>
                <div class="date-ar arabic">${L.statement_date?.ar || 'تاريخ الكشف'}</div>
            </div>
        </div>
        
        <div class="content">
            <!-- Garage & Platform Info -->
            <div class="info-grid">
                <div class="info-card highlight">
                    <div class="info-header">
                        <span class="info-label-en">GARAGE / الورشة</span>
                    </div>
                    <div class="info-name">${data.garage?.name || 'N/A'}</div>
                    <div class="info-detail">📞 ${data.garage?.phone || 'N/A'}</div>
                    <div class="info-detail">📍 ${data.garage?.address || 'Qatar'}</div>
                    ${data.garage?.cr_number && data.garage.cr_number !== 'N/A' ? `<div class="info-detail">🏢 ${L.cr_number?.en || 'CR'}: ${data.garage.cr_number}</div>` : ''}
                </div>
                <div class="info-card">
                    <div class="info-header">
                        <span class="info-label-en">${L.platform?.en || 'Platform'} / ${L.platform?.ar || 'المنصة'}</span>
                    </div>
                    <div class="info-name">${data.platform?.name || 'QScrap'} <span class="arabic">${data.platform?.name_ar || 'كيو سكراب'}</span></div>
                    <div class="info-detail">📋 Order: ${data.customer_ref?.order_number || data.order_number}</div>
                    <div class="info-detail">👤 Customer: ${data.customer_ref?.name || 'N/A'}</div>
                </div>
            </div>
            
            <!-- Item Sold -->
            <div class="section">
                <div class="section-header">
                    <span>${L.item_details?.en || 'Item Details'}</span>
                    <span class="arabic">${L.item_details?.ar || 'تفاصيل القطعة'}</span>
                </div>
                <div class="section-content">
                    <div class="item-meta-grid">
                        <div class="item-main">
                            <div class="item-name">${data.item?.part_name || 'Auto Part'}</div>
                            <div class="item-details">
                                Vehicle: ${data.item?.vehicle || 'N/A'}<br>
                                Part #: ${data.item?.part_number || 'N/A'}
                            </div>
                        </div>
                        <div class="item-condition">
                            <div class="condition-label">${L.condition?.en || 'Condition'}</div>
                            <div class="condition-value">${cond.en}</div>
                            <div class="arabic" style="font-size: 10px; color: #666;">${cond.ar}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Payout Breakdown -->
            <div class="section">
                <div class="section-header">
                    <span>PAYOUT BREAKDOWN</span>
                    <span class="arabic">تفاصيل المستحقات</span>
                </div>
                <div class="section-content">
                    <div class="pricing-breakdown">
                        <div class="price-row">
                            <div class="price-label">
                                <span class="price-label-en">${L.part_price?.en || 'Part Price'}</span>
                                <span class="price-label-ar arabic">${L.part_price?.ar || 'سعر القطعة'}</span>
                            </div>
                            <span class="price-value">${formatMoney(data.pricing?.part_price || 0)} QAR</span>
                        </div>
                        <div class="price-row fee">
                            <div class="price-label">
                                <span class="price-label-en">${L.platform_fee?.en || 'Platform Fee'} (${data.pricing?.commission_rate_percent || '15%'})</span>
                                <span class="price-label-ar arabic">${L.platform_fee?.ar || 'رسوم المنصة'}</span>
                            </div>
                            <span class="price-value">- ${formatMoney(data.pricing?.platform_fee || 0)} QAR</span>
                        </div>
                        <div class="price-row payout">
                            <div class="price-label">
                                <span class="price-label-en">${L.your_earnings?.en || 'Your Earnings'}</span>
                                <span class="price-label-ar arabic">${L.your_earnings?.ar || 'أرباحك'}</span>
                            </div>
                            <span class="price-value">${formatMoney(data.pricing?.net_payout || 0)} QAR</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <div class="footer-info">
                    <strong>Order:</strong> ${data.order_number}<br>
                    <strong>Payment Status:</strong> ${data.payment?.status || 'Completed'}
                    <div class="footer-tagline">${L.generated_via?.en || 'Generated via QScrap Platform'}</div>
                </div>
                <div class="qr-section">
                    <div class="qr-code">
                        ${qrCode ? `<img src="${qrCode}" alt="QR Code">` : ''}
                    </div>
                    <div class="qr-label">${L.scan_to_verify?.en || 'Scan to verify'}</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}
