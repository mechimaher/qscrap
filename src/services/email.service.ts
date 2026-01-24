// QScrap Email Service - Handles all email communications
// Supports OTP verification, notifications, and transactional emails

import nodemailer from 'nodemailer';

interface EmailConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
}

export class EmailService {
    private transporter: nodemailer.Transporter;
    private fromEmail: string;
    private fromName: string;

    constructor() {
        // Initialize with environment variables
        const config: EmailConfig = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER || '',
                pass: process.env.SMTP_PASS || ''
            }
        };

        this.fromEmail = process.env.SMTP_FROM || 'noreply@qscrap.qa';
        this.fromName = 'QScrap Qatar';

        this.transporter = nodemailer.createTransport(config);

        // Verify connection
        this.verifyConnection();
    }

    /**
     * Verify SMTP connection
     */
    private async verifyConnection() {
        try {
            await this.transporter.verify();
            console.log('[Email] SMTP connection verified');
        } catch (error: any) {
            console.error('[Email] SMTP verification failed:', error.message);
        }
    }

    /**
     * Send OTP verification email
     */
    async sendOTPEmail(email: string, otp: string, name?: string): Promise<boolean> {
        const subject = 'Verify Your QScrap Account';
        const html = this.getOTPEmailTemplate(otp, name);

        return this.send(email, subject, html);
    }

    /**
     * Send generic email
     */
    async send(to: string, subject: string, html: string, text?: string): Promise<boolean> {
        try {
            const info = await this.transporter.sendMail({
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to,
                subject,
                html,
                text: text || this.stripHtml(html)
            });

            console.log(`[Email] Sent to ${to}: ${info.messageId}`);
            return true;
        } catch (error: any) {
            console.error(`[Email] Failed to send to ${to}:`, error.message);
            return false;
        }
    }

    /**
     * OTP Email Template
     */
    private getOTPEmailTemplate(otp: string, name?: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your QScrap Account</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header { 
            background: linear-gradient(135deg, #8A1538 0%, #5A0F28 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        .header p {
            font-size: 14px;
            opacity: 0.9;
            font-weight: 500;
        }
        .content { 
            padding: 40px 30px;
        }
        .content h2 {
            font-size: 24px;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 16px;
        }
        .content p {
            font-size: 16px;
            line-height: 1.6;
            color: #525252;
            margin-bottom: 20px;
        }
        .otp-box { 
            background: linear-gradient(135deg, #f9f9f9 0%, #ffffff 100%);
            border: 3px dashed #8A1538;
            padding: 30px;
            text-align: center;
            font-size: 42px;
            font-weight: 800;
            letter-spacing: 12px;
            color: #8A1538;
            margin: 30px 0;
            border-radius: 12px;
            font-family: 'Courier New', monospace;
        }
        .highlight {
            color: #8A1538;
            font-weight: 700;
        }
        .info-box {
            background: #FFF4E6;
            border-left: 4px solid #F59E0B;
            padding: 16px;
            margin: 24px 0;
            border-radius: 8px;
        }
        .info-box p {
            margin: 0;
            font-size: 14px;
            color: #78350F;
        }
        .footer { 
            background: #f9f9f9;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
        }
        .footer p {
            font-size: 13px;
            color: #666;
            margin-bottom: 8px;
        }
        .footer a {
            color: #8A1538;
            text-decoration: none;
            font-weight: 600;
        }
        .social-links {
            margin-top: 20px;
        }
        .social-links a {
            display: inline-block;
            margin: 0 8px;
            color: #8A1538;
            font-size: 12px;
            text-decoration: none;
        }
        @media (max-width: 600px) {
            .container { margin: 0; border-radius: 0; }
            .header, .content, .footer { padding: 30px 20px; }
            .otp-box { font-size: 32px; letter-spacing: 8px; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 QScrap</h1>
            <p>Premium Auto Parts Marketplace</p>
        </div>
        
        <div class="content">
            <h2>Welcome${name ? ` ${name}` : ''}! 👋</h2>
            <p>Thank you for joining QScrap, Qatar's premier marketplace for auto parts. We're excited to have you on board!</p>
            
            <p>To complete your registration and verify your email address, please enter the following verification code:</p>
            
            <div class="otp-box">${otp}</div>
            
            <p>This code will expire in <span class="highlight">10 minutes</span> for your security.</p>
            
            <div class="info-box">
                <p><strong>⚠️ Security Note:</strong> If you didn't create a QScrap account, please disregard this email. Your email address will not be used without verification.</p>
            </div>
            
            <p>Need assistance? Our support team is ready to help:</p>
            <p style="margin-bottom: 8px;">
                📞 WhatsApp: <a href="https://wa.me/97455555555">+974 5555 5555</a><br>
                📧 Email: <a href="mailto:support@qscrap.qa">support@qscrap.qa</a>
            </p>
        </div>
        
        <div class="footer">
            <p><strong>QScrap Qatar</strong></p>
            <p>Your trusted partner for genuine auto parts</p>
            <p style="margin-top: 16px; font-size: 12px;">
                © 2026 QScrap Qatar. All rights reserved.
            </p>
            <p style="font-size: 11px; color: #999; margin-top: 8px;">
                This is an automated message. Please do not reply to this email.
            </p>
            <div class="social-links">
                <a href="#">Instagram</a> | 
                <a href="#">Facebook</a> | 
                <a href="#">Twitter</a>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Strip HTML tags for plain text version
     */
    private stripHtml(html: string): string {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email: string, otp: string, name?: string): Promise<boolean> {
        const subject = 'Reset Your QScrap Password';
        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Reset Password</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px;">
        <h2>Password Reset Request</h2>
        <p>Hello${name ? ` ${name}` : ''},</p>
        <p>We received a request to reset your QScrap password. Use the code below to proceed:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border: 2px dashed #8A1538; border-radius: 8px; color: #8A1538;">
            ${otp}
        </div>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email or contact support.</p>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">© 2026 QScrap Qatar</p>
    </div>
</body>
</html>
        `;

        return this.send(email, subject, html);
    }
}

export const emailService = new EmailService();
