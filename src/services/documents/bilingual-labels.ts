/**
 * Bilingual Labels for Qatar Ministry of Commerce Compliance
 * Arabic + English labels for invoices and documents
 */

export const BILINGUAL_LABELS = {
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
    support_info: { en: 'Customer Support', ar: 'خدمة العملاء' },
    need_help: { en: 'Need Help?', ar: 'تحتاج مساعدة؟' },
};

// Company official contact information (Qatar Commercial Registration)
// Authority: Identity-Brand-BRAIN.md
export const COMPANY_INFO = {
    // Legal Name (for invoices, contracts, PDFs)
    name: { en: 'QScrap Services & Trading L.L.C', ar: 'كيوسكراب للخدمات والتجارة ذ.م.م' },
    // Brand Name (for logos, marketing)
    brand: { en: 'QScrap', ar: 'كيو سكراب' },
    support_phone: '+974 4455 4444',
    support_email: 'support@qscrap.qa',
    website: 'www.qscrap.qa',
    address: {
        en: 'Industrial Area, Street 10, P.O. Box 32544, Doha, Qatar',
        ar: 'المنطقة الصناعية، شارع 10، ص.ب 32544، الدوحة، قطر'
    },
    country: { en: 'State of Qatar', ar: 'دولة قطر' },
    cr_number: '', // Will be added when CR is obtained
};

export function formatConditionBilingual(condition: string): { en: string; ar: string } {
    const key = `condition_${condition}` as keyof typeof BILINGUAL_LABELS;
    return BILINGUAL_LABELS[key] || { en: condition, ar: condition };
}
