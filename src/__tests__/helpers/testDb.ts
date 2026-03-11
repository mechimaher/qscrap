import pool from '../../config/db';

export const createUser = async (id: string, type: 'customer' | 'garage', phone: string) => {
    await pool.query(`
        INSERT INTO users (user_id, phone_number, password_hash, user_type, full_name)
        VALUES ($1, $2, 'x', $3, $4)
        ON CONFLICT (user_id) DO NOTHING;
    `, [id, phone, type, `Test ${type}`]);
};

export const createGarage = async (id: string, name: string, phone: string) => {
    await pool.query(`
        INSERT INTO garages (garage_id, garage_name, phone_number)
        VALUES ($1, $2, $3)
        ON CONFLICT (garage_id) DO NOTHING;
    `, [id, name, phone]);
};

export const createOrder = async (params: {
    orderId: string;
    customerId: string;
    garageId: string;
    total: number;
    deliveryFee: number;
}) => {
    const { orderId, customerId, garageId, total, deliveryFee } = params;
    await pool.query(`
        INSERT INTO orders (
            order_id, order_number, customer_id, garage_id, part_price, commission_rate,
            platform_fee, delivery_fee, total_amount, garage_payout_amount, payment_method,
            payment_status, order_status
        )
        VALUES ($1, 'TEST-001', $2, $3, $4, 0.10, $5, $6, $7, $4, 'card', 'paid', 'confirmed')
        ON CONFLICT (order_id) DO NOTHING;
    `, [orderId, customerId, garageId, total - deliveryFee, total * 0.1, deliveryFee, total]);
};

export const resetEscrowFixtures = async (orderId: string, userIds: string[]) => {
    await pool.query('DELETE FROM escrow_transactions WHERE order_id = $1', [orderId]);
    await pool.query('DELETE FROM orders WHERE order_id = $1', [orderId]);
    await pool.query('DELETE FROM garages WHERE garage_id = $1', [userIds[1]]);
    await pool.query('DELETE FROM users WHERE user_id = ANY($1::uuid[])', [userIds]);
};
