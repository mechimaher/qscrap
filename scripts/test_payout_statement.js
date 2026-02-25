const jwt = require('jsonwebtoken');

async function test() {
    try {
        const payload = {
            userId: '1',
            userType: 'finance',
        };
        const token = jwt.sign(payload, 'qscrap_jwt_secret_2026_production_key', { expiresIn: '1h' });
        
        console.log('Testing with token:', token);
        
        const fetch = (await import('node-fetch')).default;
        const res = await fetch('https://qscrap.qa/api/finance/payouts/statement/6cbc4d4b-7c98-4508-9dba-5a4372351b20?from_date=2026-01-26&to_date=2026-02-25&format=pdf', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text.substring(0, 500));
    } catch(err) {
        console.error(err);
    }
}
test();
