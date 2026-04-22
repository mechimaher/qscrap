
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
    console.log('--- Starting SMTP Connectivity Test ---');
    
    const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    };

    console.log('Configuration:');
    console.log(`- Host: ${config.host}`);
    console.log(`- Port: ${config.port}`);
    console.log(`- Secure: ${config.secure}`);
    console.log(`- User: ${config.auth.user ? config.auth.user : 'MISSING'}`);
    console.log(`- Pass: ${config.auth.pass ? '********' : 'MISSING'}`);
    console.log(`- From: ${process.env.SMTP_FROM || 'noreply@qscrap.qa'}`);

    if (!config.auth.user || !config.auth.pass) {
        console.error('❌ Error: SMTP credentials are missing in .env');
        process.exit(1);
    }

    const transporter = nodemailer.createTransport(config);

    try {
        console.log('\n1. Verifying connection...');
        await transporter.verify();
        console.log('✅ Connection verified successfully!');

        console.log('\n2. Attempting to send test email...');
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'QScrap Test'}" <${process.env.SMTP_FROM || 'noreply@qscrap.qa'}>`,
            to: process.env.SMTP_USER, // Send to self
            subject: 'QScrap SMTP Test',
            text: 'If you receive this, the QScrap SMTP configuration is working correctly.',
            html: '<b>If you receive this, the QScrap SMTP configuration is working correctly.</b>'
        });

        console.log('✅ Test email sent!');
        console.log(`- Message ID: ${info.messageId}`);
        console.log(`- Response: ${info.response}`);

    } catch (error) {
        console.error('❌ SMTP Test Failed!');
        console.error('Error Details:');
        console.error(`- Code: ${error.code}`);
        console.error(`- Message: ${error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Suggestion: The connection was refused. Check if the SMTP host and port are correct, and ensure the VPS allows outgoing traffic on this port.');
        } else if (error.code === 'EAUTH') {
            console.error('\n💡 Suggestion: Authentication failed. Verify your SMTP_USER and SMTP_PASS. If using Gmail, you may need an App Password.');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('\n💡 Suggestion: Connection timed out. This often means a firewall is blocking the port.');
        }
    }
}

testSMTP();
