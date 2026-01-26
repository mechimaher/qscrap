/**
 * Document Service Types
 */

export interface DocumentData {
    invoice_type?: 'customer' | 'garage';
    invoice_number?: string;
    invoice_date?: string;
    order_number?: string;
    labels?: Record<string, { en: string; ar: string }>;

    // Customer invoice (B2C)
    seller?: {
        name: string;
        phone: string;
        address: string;
        cr_number: string;
        trade_license?: string | null;
    };
    buyer?: {
        name: string;
        phone: string;
        address: string;
    };

    // Garage statement (B2B)
    garage?: {
        name: string;
        phone: string;
        address: string;
        cr_number: string;
        trade_license?: string | null;
    };
    platform?: {
        name: string;
        name_ar: string;
    };
    customer_ref?: {
        name: string;
        phone?: string;
        order_number: string;
    };

    // Item details
    item?: {
        vehicle: string;
        category?: string;
        subcategory?: string;
        part_name: string;
        part_number: string;
        condition: { en: string; ar: string };
        warranty_days: number;
        warranty_expiry?: string;
    };

    // Pricing
    pricing?: {
        part_price: number;
        delivery_fee?: number;
        loyalty_discount?: number;
        loyalty_discount_percent?: number;
        vat_rate?: number;
        vat_amount?: number;
        total?: number;
        commission_rate?: number;
        commission_rate_percent?: string;
        platform_fee?: number;
        net_payout?: number;
    };

    // Verification
    verification?: {
        code: string;
        url: string;
    };

    // Payment
    payment?: {
        method: string;
        status: string;
    };

    // Company support info (Qatar commercial compliance)
    company?: {
        name: { en: string; ar: string };
        support_phone: string;
        support_email: string;
        website: string;
        address: { en: string; ar: string };
        cr_number: string;
    };

    [key: string]: unknown;
}

export interface GenerateInvoiceParams {
    orderId: string;
    userId: string;
    userType: string;
    invoiceType: 'customer' | 'garage';
    ipAddress?: string;
}

export interface DocumentRecord {
    document_id: string;
    document_type: string;
    document_number: string;
    order_id: string;
    customer_id: string;
    garage_id: string;
    document_data: DocumentData | string;
    verification_code: string;
    verification_url: string;
    qr_code_data?: string;
    digital_signature: string;
    signature_timestamp: Date;
    status: string;
    created_by: string;
    created_by_type: string;
    generated_at?: Date;
    viewed_at?: Date;
    downloaded_at?: Date;
    [key: string]: unknown;
}
