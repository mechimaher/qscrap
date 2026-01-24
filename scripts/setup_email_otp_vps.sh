#!/bin/bash
# Update VPS .env and run Email OTP migration

echo "📧 Configuring Email OTP on VPS..."

# SSH command to update .env and run migration
ssh root@147.93.89.153 << 'ENDSSH'
cd /opt/qscrap

# 1. Update .env with SendGrid credentials
echo ""
echo "📝 Updating .env with SendGrid configuration..."
cat >> .env << 'EOF'

# Email Configuration (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=***REDACTED***
SMTP_FROM=noreply@qscrap.qa
EOF

echo "✅ SendGrid configuration added to .env"

# 2. Run Email OTP migration
echo ""
echo "🗄️  Running Email OTP migration..."
docker-compose exec -T backend node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'qscrap_db'
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('[Migration] Reading SQL file...');
    const sql = fs.readFileSync('./scripts/migrations/20260124_add_email_otp_system.sql', 'utf8');
    
    console.log('[Migration] Executing migration...');
    await client.query(sql);
    
    console.log('[Migration] ✅ Email OTP migration completed successfully!');
    console.log('[Migration] Created: email_otps table');
    console.log('[Migration] Added: users.email, users.email_verified columns');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ Failed:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
"

# 3. Restart backend to load new env vars
echo ""
echo "🔄 Restarting backend..."
docker-compose restart backend

echo ""
echo "✅ Email OTP setup complete!"
echo "Backend will be ready in ~10 seconds..."

ENDSSH

echo ""
echo "🎉 Done! Email OTP is now configured on VPS."
