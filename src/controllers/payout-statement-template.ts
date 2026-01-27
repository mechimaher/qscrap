/**
 * Payout Statement HTML Template
 * Qatar Ministry of Commerce Compliant - Bilingual Arabic/English
 * Consolidated statement showing all confirmed payouts for a period
 */

import { PayoutStatementData } from '../services/finance/types';
import { COMPANY_INFO } from '../services/documents/bilingual-labels';

// Format helpers
function formatDate(dateStr: string | Date): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(n: number): string {
    return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Generate bilingual consolidated payout statement HTML
 */
export function generatePayoutStatementHTML(
    data: PayoutStatementData,
    qrCode: string,
    logoBase64: string = ''
): string {
    const { statement_number, period, garage, summary, orders, generated_at } = data;

    // Order rows HTML
    const orderRowsHTML = orders.map((order, idx) => `
        <tr>
            <td style="text-align:center;padding:6px 4px;">${idx + 1}</td>
            <td style="padding:6px 4px;">${formatDate(order.confirmed_at)}</td>
            <td style="padding:6px 4px;">${order.order_number}</td>
            <td style="padding:6px 4px;">${order.part_name}</td>
            <td style="text-align:right;padding:6px 4px;">${formatMoney(order.gross_amount)}</td>
            <td style="text-align:right;padding:6px 4px;">${formatMoney(order.platform_fee)}</td>
            <td style="text-align:right;padding:6px 4px;font-weight:600;">${formatMoney(order.net_amount)}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payout Statement ${statement_number}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #1a1a1a;
            background: #fff;
            padding: 20px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 15px;
        }
        
        .logo-section { max-width: 120px; }
        .logo-section img { max-width: 100%; height: auto; }
        
        .title-section { text-align: center; flex: 1; }
        .title-section h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
        .title-section .ar { font-size: 16px; color: #333; direction: rtl; }
        .title-section .stmt-num { font-size: 12px; color: #666; margin-top: 5px; }
        
        .period-section { text-align: right; font-size: 10px; }
        .period-section .label { color: #666; }
        .period-section .dates { font-weight: 600; }
        
        .garage-box {
            background: #f5f5f5;
            border: 1px solid #ddd;
            padding: 12px 15px;
            margin-bottom: 15px;
        }
        
        .garage-box h3 { font-size: 12px; color: #666; margin-bottom: 5px; }
        .garage-box .name { font-size: 14px; font-weight: 600; }
        .garage-box .name-ar { font-size: 13px; direction: rtl; color: #333; }
        .garage-box .details { font-size: 10px; color: #555; margin-top: 5px; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        
        thead th {
            background: #1a1a1a;
            color: #fff;
            font-weight: 600;
            padding: 8px 4px;
            text-align: left;
            font-size: 10px;
        }
        
        thead th.ar { direction: rtl; font-size: 9px; font-weight: 500; }
        thead th.num { text-align: right; }
        
        tbody tr { border-bottom: 1px solid #e0e0e0; }
        tbody tr:nth-child(even) { background: #fafafa; }
        
        .summary-row {
            background: #e8f5e9 !important;
            font-weight: 700;
        }
        
        .summary-row td { padding: 10px 4px !important; }
        
        .totals-box {
            background: #f0f0f0;
            border: 2px solid #000;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }
        
        .totals-box .stat { text-align: center; }
        .totals-box .stat .label { font-size: 9px; color: #666; text-transform: uppercase; }
        .totals-box .stat .value { font-size: 16px; font-weight: 700; }
        .totals-box .stat .value.highlight { color: #2e7d32; }
        
        .footer {
            border-top: 1px solid #ddd;
            padding-top: 15px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        
        .qr-section { text-align: center; }
        .qr-section img { max-width: 80px; }
        .qr-section .verify { font-size: 8px; color: #666; }
        
        .company-info { text-align: right; font-size: 9px; color: #666; }
        .company-info .line { margin: 2px 0; }
        
        .generated { font-size: 8px; color: #999; margin-top: 10px; }

        /* PDF page-break rules */
        .totals-box {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        .footer {
            page-break-inside: avoid;
            break-inside: avoid;
        }
        
        .summary-row {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        @media print {
            body { padding: 10px; }
            .no-print { display: none; }
            .totals-box, .footer, .summary-row {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <div class="logo-section">
            ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="QScrap" />` : '<div style="font-size:20px;font-weight:700;">QScrap</div>'}
        </div>
        <div class="title-section">
            <h1>TAX INVOICE</h1>
            <div class="ar">فاتورة ضريبية</div>
            <div class="stmt-num">${statement_number}</div>
        </div>
        <div class="period-section">
            <div class="label">Period / الفترة</div>
            <div class="dates">${formatDate(period.from_date)}</div>
            <div class="dates">to ${formatDate(period.to_date)}</div>
        </div>
    </div>

    <!-- Garage Info -->
    <div class="garage-box">
        <h3>GARAGE / الورشة</h3>
        <div class="name">${garage.garage_name}</div>
        ${garage.garage_name_ar ? `<div class="name-ar">${garage.garage_name_ar}</div>` : ''}
        <div class="details">
            ${garage.cr_number ? `CR: ${garage.cr_number} | ` : ''}
            ${garage.iban ? `IBAN: ${garage.iban}` : ''}
            ${garage.bank_name ? ` (${garage.bank_name})` : ''}
        </div>
    </div>

    <!-- Orders Table -->
    <table>
        <thead>
            <tr>
                <th style="width:30px;text-align:center;">#</th>
                <th>Date<br/><span class="ar">التاريخ</span></th>
                <th>Order #<br/><span class="ar">رقم الطلب</span></th>
                <th>Part Description<br/><span class="ar">وصف القطعة</span></th>
                <th class="num">Gross<br/><span class="ar">الإجمالي</span></th>
                <th class="num">Fee<br/><span class="ar">العمولة</span></th>
                <th class="num">Net<br/><span class="ar">الصافي</span></th>
            </tr>
        </thead>
        <tbody>
            ${orderRowsHTML}
            <tr class="summary-row">
                <td colspan="4" style="text-align:right;font-weight:700;">
                    TOTALS (${summary.total_orders} orders) / المجموع
                </td>
                <td style="text-align:right;">${formatMoney(summary.gross_amount)} QAR</td>
                <td style="text-align:right;">${formatMoney(summary.total_platform_fee)} QAR</td>
                <td style="text-align:right;color:#2e7d32;">${formatMoney(summary.net_payout)} QAR</td>
            </tr>
        </tbody>
    </table>

    <!-- Totals Summary Box -->
    <div class="totals-box">
        <div class="stat">
            <div class="label">Total Orders / عدد الطلبات</div>
            <div class="value">${summary.total_orders}</div>
        </div>
        <div class="stat">
            <div class="label">Gross Amount / الإجمالي</div>
            <div class="value">${formatMoney(summary.gross_amount)} QAR</div>
        </div>
        <div class="stat">
            <div class="label">Platform Fee (${summary.platform_fee_percentage}%) / العمولة</div>
            <div class="value">${formatMoney(summary.total_platform_fee)} QAR</div>
        </div>
        <div class="stat">
            <div class="label">Net Payout / صافي المستحق</div>
            <div class="value highlight">${formatMoney(summary.net_payout)} QAR</div>
        </div>
    </div>

    <!-- Footer -->
    <div class="footer">
        <div class="qr-section">
            ${qrCode ? `<img src="${qrCode}" alt="Verify" />` : ''}
            <div class="verify">Scan to verify / امسح للتحقق</div>
        </div>
        <div class="company-info">
            <div class="line"><strong>${COMPANY_INFO?.name?.en || 'QScrap'}</strong> | <span style="direction:rtl;">${COMPANY_INFO?.name?.ar || 'كيو سكراب'}</span></div>
            ${COMPANY_INFO?.cr_number ? `<div class="line">CR / السجل التجاري: ${COMPANY_INFO.cr_number}</div>` : ''}
            <div class="line">Tel: ${COMPANY_INFO?.support_phone || '+974 4455 4444'}</div>
            <div class="line">Email: ${COMPANY_INFO?.support_email || 'support@qscrap.qa'}</div>
            <div class="line">Web: ${COMPANY_INFO?.website || 'www.qscrap.qa'}</div>
            <div class="line">${COMPANY_INFO?.address?.en || 'Industrial Area, St 10, P.O. Box 32544, Doha, Qatar'}</div>
        </div>
    </div>

    <div class="generated">
        Generated: ${formatDate(generated_at)} | This is a computer-generated document.
    </div>
</body>
</html>`;
}
