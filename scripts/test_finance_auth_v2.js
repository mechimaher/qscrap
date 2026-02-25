const jwt = require('jsonwebtoken');

async function test() {
    try {
        const payload = {
            userId: '1',
            userType: 'finance',
            staffRole: 'finance'
        };
        const token = jwt.sign(payload, 'qscrap_jwt_secret_2026_production_key', { expiresIn: '1h' });
        
        console.log('Testing with token:', token);
        
        const fetch = (await import('node-fetch')).default;
        const res = await fetch('https://qscrap.qa/api/operations/dashboard/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Body:', text.substring(0, 100));
    } catch(err) {
        console.error(err);
    }
}
test();
