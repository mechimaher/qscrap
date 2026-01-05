const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432')
});

async function seedSubscriptions() {
    const client = await pool.connect();
    try {
        console.log('🔌 Connected to VPS Database');
        console.log('🌱 Seeding subscription plans...\n');

        // ========== 1. SEED SUBSCRIPTION PLANS ==========
        const plans = [
            {
                plan_code: 'starter',
                plan_name: 'Starter',
                plan_name_ar: 'المبتدئ',
                monthly_fee: 99.00,
                commission_rate: 0.08,  // 8%
                max_bids_per_month: 50,
                features: {
                    bid_priority: 'normal',
                    analytics: 'basic',
                    support: 'email',
                    showcase: false,
                    api_access: false
                },
                is_featured: false,
                display_order: 1
            },
            {
                plan_code: 'professional',
                plan_name: 'Professional',
                plan_name_ar: 'احترافي',
                monthly_fee: 299.00,
                commission_rate: 0.05,  // 5%
                max_bids_per_month: 200,
                features: {
                    bid_priority: 'high',
                    analytics: 'advanced',
                    support: 'priority',
                    showcase: true,
                    api_access: false
                },
                is_featured: true,
                display_order: 2
            },
            {
                plan_code: 'enterprise',
                plan_name: 'Enterprise',
                plan_name_ar: 'المؤسسات',
                monthly_fee: 599.00,
                commission_rate: 0.03,  // 3%
                max_bids_per_month: null,  // Unlimited
                features: {
                    bid_priority: 'highest',
                    analytics: 'premium',
                    support: 'dedicated',
                    showcase: true,
                    api_access: true,
                    white_label: true
                },
                is_featured: false,
                display_order: 3
            }
        ];

        let enterprisePlanId = null;

        for (const plan of plans) {
            const check = await client.query('SELECT plan_id FROM subscription_plans WHERE plan_code = $1', [plan.plan_code]);

            if (check.rows.length === 0) {
                const res = await client.query(`
                    INSERT INTO subscription_plans (
                        plan_code, plan_name, plan_name_ar, monthly_fee, 
                        commission_rate, max_bids_per_month, features, 
                        is_featured, display_order
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING plan_id;
                `, [
                    plan.plan_code, plan.plan_name, plan.plan_name_ar,
                    plan.monthly_fee, plan.commission_rate, plan.max_bids_per_month,
                    JSON.stringify(plan.features), plan.is_featured, plan.display_order
                ]);
                console.log(`✅ Created plan: ${plan.plan_name} (${plan.plan_code})`);

                if (plan.plan_code === 'enterprise') {
                    enterprisePlanId = res.rows[0].plan_id;
                }
            } else {
                console.log(`⚠️ Plan already exists: ${plan.plan_name}`);
                if (plan.plan_code === 'enterprise') {
                    enterprisePlanId = check.rows[0].plan_id;
                }
            }
        }

        // ========== 2. ADD ENTERPRISE SUBSCRIPTION FOR DEMO GARAGE ==========
        console.log('\n📦 Adding Enterprise subscription for demo garage...');

        // Get the demo garage ID
        const garageResult = await client.query(
            "SELECT garage_id FROM garages WHERE phone_number = '+97450000004'"
        );

        if (garageResult.rows.length === 0) {
            console.log('❌ Demo garage not found!');
        } else {
            const garageId = garageResult.rows[0].garage_id;

            // Check if subscription already exists
            const subCheck = await client.query(
                'SELECT subscription_id FROM garage_subscriptions WHERE garage_id = $1',
                [garageId]
            );

            if (subCheck.rows.length === 0) {
                // Create 1-year enterprise subscription
                const today = new Date();
                const nextYear = new Date(today);
                nextYear.setFullYear(nextYear.getFullYear() + 1);

                await client.query(`
                    INSERT INTO garage_subscriptions (
                        garage_id, plan_id, status, 
                        billing_cycle_start, billing_cycle_end, next_billing_date,
                        bids_used_this_cycle, auto_renew, 
                        is_admin_granted, admin_notes
                    ) VALUES (
                        $1, $2, 'active',
                        $3, $4, $4,
                        0, true,
                        true, 'Demo Enterprise subscription granted by admin'
                    );
                `, [garageId, enterprisePlanId, today.toISOString().split('T')[0], nextYear.toISOString().split('T')[0]]);

                console.log(`✅ Created Enterprise subscription for garage (valid until ${nextYear.toISOString().split('T')[0]})`);
            } else {
                console.log('⚠️ Garage already has a subscription');
            }
        }

        console.log('\n========================================');
        console.log('✅ Subscription seeding complete!');
        console.log('========================================');
        console.log('\nPlans available:');
        console.log('  • Starter:      QAR 99/mo  (50 bids, 8% commission)');
        console.log('  • Professional: QAR 299/mo (200 bids, 5% commission)');
        console.log('  • Enterprise:   QAR 599/mo (Unlimited bids, 3% commission)');
        console.log('\nDemo garage has Enterprise subscription - ready to bid!');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedSubscriptions();
