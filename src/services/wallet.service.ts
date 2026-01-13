import { getWritePool } from '../config/db';

export interface WalletTransaction {
    transaction_id: string;
    wallet_id: string;
    amount: number;
    type: 'earning' | 'cash_collection' | 'payout' | 'adjustment' | 'bonus';
    reference_id?: string;
    description?: string;
    created_at: string;
}

export interface DriverWallet {
    wallet_id: string;
    driver_id: string;
    balance: number;
    total_earned: number;
    cash_collected: number;
    last_updated: string;
}

export class WalletService {
    private pool = getWritePool();

    /**
     * Get or Create Wallet for Driver
     */
    async getWallet(driverId: string): Promise<DriverWallet> {
        const result = await this.pool.query(`
            INSERT INTO driver_wallets (driver_id)
            VALUES ($1)
            ON CONFLICT (driver_id) DO UPDATE SET last_updated = NOW()
            RETURNING *
        `, [driverId]);

        return result.rows[0];
    }

    /**
     * Add Transaction (Credit or Debit)
     * @param driverId Driver UUID
     * @param amount Positive for Credit (Earning), Negative for Debit (Cash Collection)
     * @param type Transaction Type
     * @param referenceId Order ID or Payout ID
     * @param description Description
     */
    async addTransaction(
        driverId: string,
        amount: number,
        type: WalletTransaction['type'],
        referenceId: string,
        description: string
    ): Promise<WalletTransaction> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Get Wallet
            const walletRes = await client.query(`
                SELECT wallet_id FROM driver_wallets WHERE driver_id = $1
            `, [driverId]);

            if (walletRes.rows.length === 0) {
                throw new Error('Wallet not found for driver');
            }
            const walletId = walletRes.rows[0].wallet_id;

            // 2. Insert Transaction
            const txRes = await client.query(`
                INSERT INTO driver_transactions (wallet_id, amount, type, reference_id, description)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [walletId, amount, type, referenceId, description]);

            // 3. Update Wallet Balance
            // If type is 'earning', increment total_earned
            // If type is 'cash_collection', increment cash_collected (using absolute value)
            let updateQuery = `
                UPDATE driver_wallets 
                SET balance = balance + $1, 
                    last_updated = NOW()
            `;

            if (type === 'earning') {
                updateQuery += `, total_earned = total_earned + $1`;
            } else if (type === 'cash_collection') {
                updateQuery += `, cash_collected = cash_collected + ABS($1)`;
            }

            updateQuery += ` WHERE wallet_id = $2`;

            await client.query(updateQuery, [amount, walletId]);

            await client.query('COMMIT');
            return txRes.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Get Transaction History
     */
    async getHistory(driverId: string, limit = 20, offset = 0): Promise<WalletTransaction[]> {
        const result = await this.pool.query(`
            SELECT dt.* 
            FROM driver_transactions dt
            JOIN driver_wallets dw ON dt.wallet_id = dw.wallet_id
            WHERE dw.driver_id = $1
            ORDER BY dt.created_at DESC
            LIMIT $2 OFFSET $3
        `, [driverId, limit, offset]);

        return result.rows;
    }
}

export const walletService = new WalletService();
