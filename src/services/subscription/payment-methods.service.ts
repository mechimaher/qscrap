/**
 * Payment Methods Service
 * Manage saved payment methods for garages (Stripe)
 */

import { Pool } from 'pg';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

export class PaymentMethodsService {
    constructor(private pool: Pool) { }

    /**
     * Get or create Stripe customer for garage
     */
    async getOrCreateCustomer(garageId: string): Promise<string> {
        // Check if garage already has a Stripe customer
        const garageResult = await this.pool.query(
            'SELECT stripe_customer_id, garage_name FROM garages WHERE garage_id = $1',
            [garageId]
        );

        if (garageResult.rows.length === 0) {
            throw new Error('Garage not found');
        }

        const garage = garageResult.rows[0];

        if (garage.stripe_customer_id) {
            return garage.stripe_customer_id;
        }

        // Get garage email
        const userResult = await this.pool.query(
            'SELECT email, phone_number FROM users WHERE user_id = $1',
            [garageId]
        );

        // Create Stripe customer
        const customer = await stripe.customers.create({
            name: garage.garage_name,
            email: userResult.rows[0]?.email,
            phone: userResult.rows[0]?.phone_number,
            metadata: {
                garage_id: garageId,
                platform: 'QScrap'
            }
        });

        // Save customer ID
        await this.pool.query(
            'UPDATE garages SET stripe_customer_id = $1 WHERE garage_id = $2',
            [customer.id, garageId]
        );

        console.log(`[PaymentMethods] Created Stripe customer ${customer.id} for ${garage.garage_name}`);

        return customer.id;
    }

    /**
     * Create SetupIntent for adding a new payment method
     * Returns client_secret for Stripe.js
     */
    async createSetupIntent(garageId: string): Promise<{ clientSecret: string; customerId: string }> {
        const customerId = await this.getOrCreateCustomer(garageId);

        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
            metadata: {
                garage_id: garageId,
                customer_id: customerId
            }
        });

        console.log(`[PaymentMethods] Created SetupIntent for garage ${garageId}`);

        return {
            clientSecret: setupIntent.client_secret!,
            customerId
        };
    }

    /**
     * Get saved payment methods for garage
     */
    async getPaymentMethods(garageId: string): Promise<any[]> {
        const result = await this.pool.query(`
            SELECT 
                method_id, 
                card_last4, 
                card_brand, 
                card_exp_month, 
                card_exp_year, 
                is_default,
                created_at
            FROM garage_payment_methods
            WHERE garage_id = $1
            ORDER BY is_default DESC, created_at DESC
        `, [garageId]);

        return result.rows;
    }

    /**
     * Set a payment method as default
     */
    async setDefaultPaymentMethod(garageId: string, methodId: string): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Unset all defaults for this garage
            await client.query(
                'UPDATE garage_payment_methods SET is_default = false WHERE garage_id = $1',
                [garageId]
            );

            // Set new default
            const result = await client.query(
                'UPDATE garage_payment_methods SET is_default = true WHERE method_id = $1 AND garage_id = $2 RETURNING *',
                [methodId, garageId]
            );

            if (result.rows.length === 0) {
                throw new Error('Payment method not found');
            }

            // Update Stripe customer default
            const garageResult = await client.query(
                'SELECT stripe_customer_id FROM garages WHERE garage_id = $1',
                [garageId]
            );

            if (garageResult.rows[0]?.stripe_customer_id) {
                await stripe.customers.update(garageResult.rows[0].stripe_customer_id, {
                    invoice_settings: {
                        default_payment_method: result.rows[0].stripe_payment_method_id
                    }
                });
            }

            await client.query('COMMIT');
            console.log(`[PaymentMethods] Set default payment method for garage ${garageId}`);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Delete a saved payment method
     */
    async deletePaymentMethod(garageId: string, methodId: string): Promise<void> {
        // Get Stripe payment method ID
        const result = await this.pool.query(
            'SELECT stripe_payment_method_id, is_default FROM garage_payment_methods WHERE method_id = $1 AND garage_id = $2',
            [methodId, garageId]
        );

        if (result.rows.length === 0) {
            throw new Error('Payment method not found');
        }

        const paymentMethod = result.rows[0];

        // Detach from Stripe
        try {
            await stripe.paymentMethods.detach(paymentMethod.stripe_payment_method_id);
        } catch (err) {
            console.warn('[PaymentMethods] Failed to detach from Stripe:', err);
        }

        // Delete from database
        await this.pool.query(
            'DELETE FROM garage_payment_methods WHERE method_id = $1',
            [methodId]
        );

        // If was default, set another as default
        if (paymentMethod.is_default) {
            await this.pool.query(`
                UPDATE garage_payment_methods 
                SET is_default = true 
                WHERE garage_id = $1 
                AND method_id = (
                    SELECT method_id FROM garage_payment_methods WHERE garage_id = $1 ORDER BY created_at DESC LIMIT 1
                )
            `, [garageId]);
        }

        console.log(`[PaymentMethods] Deleted payment method ${methodId}`);
    }

    /**
     * Manually add a payment method (for webhook fallback)
     */
    async addPaymentMethod(
        garageId: string,
        stripePaymentMethodId: string,
        stripeCustomerId: string
    ): Promise<void> {
        // Get card details from Stripe
        const paymentMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

        if (!paymentMethod.card) {
            throw new Error('Only card payment methods are supported');
        }

        // Check if this is first payment method
        const existing = await this.pool.query(
            'SELECT COUNT(*) FROM garage_payment_methods WHERE garage_id = $1',
            [garageId]
        );
        const isDefault = existing.rows[0].count === '0';

        await this.pool.query(`
            INSERT INTO garage_payment_methods 
            (garage_id, stripe_payment_method_id, stripe_customer_id, card_last4, card_brand, card_exp_month, card_exp_year, is_default)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (stripe_payment_method_id) DO UPDATE SET updated_at = NOW()
        `, [
            garageId,
            stripePaymentMethodId,
            stripeCustomerId,
            paymentMethod.card.last4,
            paymentMethod.card.brand,
            paymentMethod.card.exp_month,
            paymentMethod.card.exp_year,
            isDefault
        ]);

        console.log(`[PaymentMethods] Added ${paymentMethod.card.brand} ****${paymentMethod.card.last4}`);
    }
}
