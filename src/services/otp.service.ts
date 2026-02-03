// QScrap OTP Service - Email Verification System
// Provides secure, cost-free email verification via 6-digit OTP codes

import crypto from 'crypto';
import pool from '../config/db';
import logger from '../utils/logger';

interface OTPResult {
    success: boolean;
    otp?: string;
    error?: string;
    waitSeconds?: number;
}

interface VerifyResult {
    success: boolean;
    error?: string;
    attemptsRemaining?: number;
}

interface RateLimitResult {
    allowed: boolean;
    waitSeconds?: number;
}

export class OTPService {
    private readonly OTP_LENGTH = 6;
    private readonly OTP_EXPIRY_MINUTES = 10;
    private readonly RESEND_COOLDOWN_SECONDS = 30;
    private readonly MAX_ATTEMPTS = 10;  // Increased from 5 for better UX

    /**
     * Generate a secure 6-digit OTP
     */
    generateOTP(): string {
        return crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Create and store OTP in database
     */
    async createOTP(
        email: string,
        purpose: string = 'registration',
        ipAddress?: string,
        userAgent?: string
    ): Promise<OTPResult> {
        try {
            email = email.toLowerCase().trim();

            // Check rate limiting
            const rateLimit = await this.canSendOTP(email);
            if (!rateLimit.allowed) {
                return {
                    success: false,
                    error: `Please wait ${rateLimit.waitSeconds} seconds before requesting another code`,
                    waitSeconds: rateLimit.waitSeconds
                };
            }

            const otp = this.generateOTP();
            const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

            await pool.query(
                `INSERT INTO email_otps (email, otp_code, purpose, expires_at, ip_address, user_agent)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [email, otp, purpose, expiresAt, ipAddress, userAgent]
            );

            logger.info('Created OTP', { email, purpose });

            return {
                success: true,
                otp
            };
        } catch (error: any) {
            logger.error('OTP create error', { error: error.message });
            return {
                success: false,
                error: 'Failed to generate OTP'
            };
        }
    }

    /**
     * Verify OTP code
     * ROBUST: Allows many attempts without requiring new OTP
     */
    async verifyOTP(
        email: string,
        otpCode: string,
        purpose: string = 'registration'
    ): Promise<VerifyResult> {
        try {
            email = email.toLowerCase().trim();

            // Find the most recent valid OTP (no transaction needed for read)
            const result = await pool.query(
                `SELECT * FROM email_otps
                 WHERE email = $1 
                 AND purpose = $2
                 AND is_used = FALSE
                 AND expires_at > NOW()
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [email, purpose]
            );

            if (result.rows.length === 0) {
                return {
                    success: false,
                    error: 'No valid OTP found. Please request a new code.'
                };
            }

            const otpRecord = result.rows[0];

            // Check if max attempts exceeded (use larger limit for robustness)
            const effectiveMaxAttempts = Math.max(otpRecord.max_attempts || this.MAX_ATTEMPTS, 10);
            if (otpRecord.attempts >= effectiveMaxAttempts) {
                return {
                    success: false,
                    error: 'Maximum verification attempts exceeded. Please request a new code.',
                    attemptsRemaining: 0
                };
            }

            // Verify the OTP code FIRST before incrementing attempts
            if (otpRecord.otp_code !== otpCode.trim()) {
                // Increment attempts OUTSIDE transaction so it persists
                await pool.query(
                    `UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1`,
                    [otpRecord.id]
                );

                const attemptsRemaining = effectiveMaxAttempts - (otpRecord.attempts + 1);

                return {
                    success: false,
                    error: attemptsRemaining > 0
                        ? `Invalid code. ${attemptsRemaining} attempts remaining.`
                        : 'Invalid code. Please request a new code.',
                    attemptsRemaining: Math.max(0, attemptsRemaining)
                };
            }

            // OTP is correct - mark as used
            await pool.query(
                `UPDATE email_otps SET is_used = TRUE WHERE id = $1`,
                [otpRecord.id]
            );

            logger.info('Successfully verified OTP', { email });

            return {
                success: true
            };
        } catch (error: any) {
            logger.error('OTP verify error', { error: error.message });
            return {
                success: false,
                error: 'Verification failed. Please try again.'
            };
        }
    }

    /**
     * Check if user can send another OTP (rate limiting)
     */
    async canSendOTP(email: string): Promise<RateLimitResult> {
        try {
            email = email.toLowerCase().trim();

            const result = await pool.query(
                `SELECT created_at FROM email_otps
                 WHERE email = $1
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [email]
            );

            if (result.rows.length === 0) {
                return { allowed: true };
            }

            const lastSent = new Date(result.rows[0].created_at);
            const now = new Date();
            const diffSeconds = Math.floor((now.getTime() - lastSent.getTime()) / 1000);

            if (diffSeconds < this.RESEND_COOLDOWN_SECONDS) {
                return {
                    allowed: false,
                    waitSeconds: this.RESEND_COOLDOWN_SECONDS - diffSeconds
                };
            }

            return { allowed: true };
        } catch (error: any) {
            logger.error('OTP rate limit check error', { error: error.message });
            // Allow on error to not block users
            return { allowed: true };
        }
    }

    /**
     * Invalidate all OTPs for an email (e.g., on successful verification)
     */
    async invalidateOTPs(email: string, purpose: string = 'registration'): Promise<void> {
        try {
            email = email.toLowerCase().trim();

            await pool.query(
                `UPDATE email_otps 
                 SET is_used = TRUE 
                 WHERE email = $1 AND purpose = $2 AND is_used = FALSE`,
                [email, purpose]
            );

            logger.info('Invalidated all OTPs', { email, purpose });
        } catch (error: any) {
            logger.error('OTP invalidate error', { error: error.message });
        }
    }

    /**
     * Cleanup expired OTPs (should be run as cron job)
     */
    async cleanupExpiredOTPs(): Promise<number> {
        try {
            const result = await pool.query(
                `DELETE FROM email_otps WHERE expires_at < NOW()`
            );

            const deletedCount = result.rowCount || 0;
            if (deletedCount > 0) {
                logger.info('Cleaned up expired OTPs', { count: deletedCount });
            }

            return deletedCount;
        } catch (error: any) {
            logger.error('OTP cleanup error', { error: error.message });
            return 0;
        }
    }

    /**
     * Get OTP statistics for monitoring
     */
    async getStats(): Promise<{ total: number; active: number; expired: number; used: number }> {
        try {
            const result = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_used = FALSE AND expires_at > NOW()) as active,
                    COUNT(*) FILTER (WHERE expires_at < NOW() AND is_used = FALSE) as expired,
                    COUNT(*) FILTER (WHERE is_used = TRUE) as used
                FROM email_otps
            `);

            return result.rows[0];
        } catch (error: any) {
            logger.error('OTP stats error', { error: error.message });
            return { total: 0, active: 0, expired: 0, used: 0 };
        }
    }
}

export const otpService = new OTPService();
