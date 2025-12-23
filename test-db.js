const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'qscrap_db'
});

pool.query('SELECT 1 as test')
    .then(res => {
        console.log('✅ Database connected! Result:', res.rows[0]);
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        console.error('Error code:', err.code);
        process.exit(1);
    });
