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

    /**
     * Send B2B Garage Welcome Email with Magic Link
     * Enterprise-grade onboarding email sent upon admin approval
     */
    async sendGarageWelcomeEmail(
        email: string,
        garageName: string,
        magicLink: string,
        expiresIn: string = '48 hours'
    ): Promise<boolean> {
        const subject = '🎉 Welcome to QScrap Partner Network - Account Approved!';
        const html = this.getGarageWelcomeTemplate(garageName, magicLink, expiresIn);
        return this.send(email, subject, html);
    }

    /**
     * VVVIP B2B Welcome Email Template - Gold Partner Edition
     * QScrap Enterprise Brand: Qatar Maroon (#8D1B3D) + Gold (#C9A227)
     * Philosophy: Garages are our Gold Partners
     */
    private getGarageWelcomeTemplate(garageName: string, magicLink: string, expiresIn: string): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to QScrap Gold Partner Network</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(180deg, #0D0D0D 0%, #1A1A1A 100%);
            padding: 40px 20px;
            line-height: 1.7;
            min-height: 100vh;
        }
        .container { 
            max-width: 640px; 
            margin: 0 auto; 
            background: linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%);
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(201, 162, 39, 0.1);
        }
        
        /* VVVIP Header with Gold Accent */
        .header { 
            background: linear-gradient(135deg, #8D1B3D 0%, #6B1530 50%, #4A0F22 100%);
            color: white;
            padding: 60px 48px 50px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at 30% 70%, rgba(201, 162, 39, 0.15) 0%, transparent 50%);
            pointer-events: none;
        }
        .gold-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, rgba(201, 162, 39, 0.25) 0%, rgba(201, 162, 39, 0.1) 100%);
            border: 2px solid #C9A227;
            color: #C9A227;
            padding: 10px 24px;
            border-radius: 100px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 28px;
            box-shadow: 0 0 30px rgba(201, 162, 39, 0.3);
        }
        .logo-text {
            font-size: 42px;
            font-weight: 800;
            letter-spacing: -1px;
            margin-bottom: 12px;
            text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        .logo-text span {
            color: #C9A227;
        }
        .header-subtitle {
            font-size: 16px;
            opacity: 0.9;
            font-weight: 500;
        }
        
        /* Main Content */
        .content { 
            padding: 56px 48px;
        }
        .welcome-title {
            font-size: 28px;
            font-weight: 800;
            color: #0D0D0D;
            margin-bottom: 24px;
            line-height: 1.3;
        }
        .welcome-title span {
            color: #8D1B3D;
        }
        .content p {
            font-size: 16px;
            color: #525252;
            margin-bottom: 24px;
        }
        .content strong {
            color: #0D0D0D;
        }
        
        /* Gold Partner Status Card */
        .partner-card {
            background: linear-gradient(135deg, #0D0D0D 0%, #1A1A1A 100%);
            border: 2px solid #C9A227;
            border-radius: 20px;
            padding: 32px;
            text-align: center;
            margin: 36px 0;
            position: relative;
            overflow: hidden;
        }
        .partner-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #C9A227 0%, #E8D48A 50%, #C9A227 100%);
        }
        .partner-icon {
            font-size: 56px;
            margin-bottom: 16px;
        }
        .partner-title {
            font-size: 22px;
            font-weight: 800;
            color: #C9A227;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .partner-desc {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
        }
        
        /* Premium CTA Button */
        .cta-container {
            text-align: center;
            padding: 24px 0 32px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #8D1B3D 0%, #6B1530 100%);
            color: white !important;
            text-decoration: none;
            padding: 20px 56px;
            border-radius: 100px;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.5px;
            box-shadow: 0 12px 40px rgba(141, 27, 61, 0.4), 0 0 0 1px rgba(201, 162, 39, 0.2);
            transition: all 0.3s ease;
        }
        
        /* Expiry Warning */
        .expiry-box {
            background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
            border-left: 5px solid #C9A227;
            padding: 18px 24px;
            margin: 32px 0;
            border-radius: 0 16px 16px 0;
        }
        .expiry-box p {
            margin: 0;
            font-size: 14px;
            color: #78350F;
            font-weight: 500;
        }
        
        /* Benefits Grid */
        .benefits-title {
            font-size: 18px;
            font-weight: 700;
            color: #0D0D0D;
            margin: 40px 0 20px;
            text-align: center;
        }
        .benefits-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }
        .benefit-item {
            background: linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%);
            border: 1px solid #E5E5E5;
            padding: 24px 20px;
            border-radius: 16px;
            text-align: center;
        }
        .benefit-icon {
            font-size: 36px;
            margin-bottom: 12px;
        }
        .benefit-title {
            font-size: 14px;
            font-weight: 700;
            color: #0D0D0D;
            margin-bottom: 4px;
        }
        .benefit-desc {
            font-size: 12px;
            color: #666;
        }
        
        /* Premium Footer */
        .footer { 
            background: linear-gradient(180deg, #0D0D0D 0%, #000000 100%);
            color: white;
            padding: 48px;
            text-align: center;
        }
        .footer-logo {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
        }
        .footer-logo span {
            color: #C9A227;
        }
        .footer-tagline {
            font-size: 13px;
            color: #C9A227;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 32px;
            font-weight: 600;
        }
        .footer p {
            font-size: 14px;
            color: #888;
            margin-bottom: 8px;
        }
        .footer a {
            color: #C9A227;
            text-decoration: none;
            font-weight: 600;
        }
        .contact-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin: 24px 0;
            padding: 24px;
            background: rgba(201, 162, 39, 0.05);
            border-radius: 16px;
            border: 1px solid rgba(201, 162, 39, 0.1);
        }
        .contact-item {
            text-align: center;
        }
        .contact-item span {
            display: block;
            font-size: 20px;
            margin-bottom: 8px;
        }
        .legal {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #222;
            font-size: 11px;
            color: #666;
        }
        
        @media (max-width: 600px) {
            body { padding: 20px 12px; }
            .container { border-radius: 16px; }
            .header, .content, .footer { padding: 36px 24px; }
            .logo-text { font-size: 32px; }
            .welcome-title { font-size: 22px; }
            .benefits-grid { grid-template-columns: 1fr; }
            .contact-grid { grid-template-columns: 1fr; gap: 12px; }
            .cta-button { padding: 18px 40px; font-size: 14px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- VVVIP Header -->
        <div class="header">
            <div class="gold-badge">
                <span>⭐</span> Gold Partner Approved
            </div>
            <div class="logo-text">Q<span>Scrap</span></div>
            <p class="header-subtitle">Qatar's Premier Automotive Parts Marketplace</p>
        </div>
        
        <!-- Main Content -->
        <div class="content">
            <h1 class="welcome-title">
                Welcome to the Family, <span>\${garageName}</span>! 🎉
            </h1>
            
            <p>Your application to join the <strong>QScrap Partner Network</strong> has been carefully reviewed and <strong>approved</strong> by our team.</p>
            
            <p>We're thrilled to have you as a <strong>Gold Partner</strong>. At QScrap, we believe our garages are the backbone of our marketplace — your success is our success.</p>
            
            <!-- Gold Partner Card -->
            <div class="partner-card">
                <div class="partner-icon">🏆</div>
                <div class="partner-title">Gold Partner Status</div>
                <p class="partner-desc">Access Qatar's largest network of auto parts buyers</p>
            </div>
            
            <p style="text-align: center;">Set up your account to start receiving orders:</p>
            
            <!-- CTA Button -->
            <div class="cta-container">
                <a href="\${magicLink}" class="cta-button">Activate Your Dashboard →</a>
            </div>
            
            <!-- Expiry Warning -->
            <div class="expiry-box">
                <p><strong>⏰ Security Notice:</strong> This activation link expires in <strong>\${expiresIn}</strong>. If it expires, contact our support team for a new link.</p>
            </div>
            
            <!-- Benefits -->
            <h3 class="benefits-title">Your Partner Benefits</h3>
            <div class="benefits-grid">
                <div class="benefit-item">
                    <div class="benefit-icon">📱</div>
                    <div class="benefit-title">Smart Dashboard</div>
                    <div class="benefit-desc">Manage orders & quotes</div>
                </div>
                <div class="benefit-item">
                    <div class="benefit-icon">💰</div>
                    <div class="benefit-title">Fast Payouts</div>
                    <div class="benefit-desc">24-48 hour settlements</div>
                </div>
                <div class="benefit-item">
                    <div class="benefit-icon">📊</div>
                    <div class="benefit-title">Analytics Suite</div>
                    <div class="benefit-desc">Track your performance</div>
                </div>
                <div class="benefit-item">
                    <div class="benefit-icon">🚀</div>
                    <div class="benefit-title">Growth Tools</div>
                    <div class="benefit-desc">Reach more customers</div>
                </div>
            </div>
        </div>
        
        <!-- Premium Footer -->
        <div class="footer">
            <div class="footer-logo">Q<span>Scrap</span></div>
            <p class="footer-tagline">Gold Partner Network</p>
            
            <div class="contact-grid">
                <div class="contact-item">
                    <span>📞</span>
                    <a href="tel:+97450267974">+974 5026 7974</a>
                </div>
                <div class="contact-item">
                    <span>📧</span>
                    <a href="mailto:partners@qscrap.qa">partners@qscrap.qa</a>
                </div>
                <div class="contact-item">
                    <span>💬</span>
                    <a href="https://wa.me/97450267974">WhatsApp</a>
                </div>
            </div>
            
            <p>Our Partner Success Team is here to help you grow.</p>
            
            <div class="legal">
                © 2026 QScrap Services & Trading L.L.C. All rights reserved.<br>
                CR: 155892 | P.O. Box 32544, Doha, Qatar
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }
}

export const emailService = new EmailService();
