// QScrap Password Reset Service - Enterprise Standard
// Provides secure password reset via email OTP with rate limiting and security logging

import crypto from 'crypto';
import pool from '../config/db';
import logger from '../utils/logger';
import { otpService } from './otp.service';
import { emailService } from './email.service';

interface PasswordResetRequest {
    email: string;
    ip_address?: string;
    user_agent?: string;
}

interface PasswordResetVerify {
    email: string;
    otp: string;
}

interface PasswordResetComplete {
    email: string;
    otp: string;
    newPassword: string;
}

interface ResetToken {
    token_id: string;
    email: string;
    otp_code: string;
    expires_at: Date;
    used: boolean;
    created_at: Date;
}

export class PasswordResetService {
    private readonly OTP_EXPIRY_MINUTES = 5;
    private readonly MAX_ATTEMPTS = 5;
    private readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
    private readonly RATE_LIMIT_MAX = 5; // 5 requests per hour

    /**
     * Step 1: Request password reset - generates and sends OTP
     */
    async requestReset(data: PasswordResetRequest): Promise<{ success: boolean; message: string }> {
        try {
            const email = data.email.toLowerCase().trim();

            // Check if user exists (but don't reveal this to client)
            const userResult = await pool.query(
                'SELECT user_id FROM users WHERE email = $1 AND email IS NOT NULL',
                [email]
            );

            // SECURITY: Always respond with success to prevent email enumeration
            // Even if email doesn't exist, we say we sent instructions
            if (userResult.rows.length === 0) {
                logger.info('Password reset requested for non-existent email', { email, ip: data.ip_address });
                return {
                    success: true,
                    message: 'If an account exists for this email, you will receive reset instructions shortly.'
                };
            }

            // Check rate limiting
            const rateLimit = await this.checkRateLimit(email);
            if (!rateLimit.allowed) {
                logger.warn('Password reset rate limit exceeded', { email, ip: data.ip_address });
                return {
                    success: true, // Still return success to prevent enumeration
                    message: 'If an account exists for this email, you will receive reset instructions shortly.'
                };
            }

            // Generate OTP via OTP service
            const otpResult = await otpService.createOTP(
                email,
                'password_reset',
                data.ip_address,
                data.user_agent
            );

            if (!otpResult.success || !otpResult.otp) {
                logger.error('Failed to create password reset OTP', { email, error: otpResult.error });
                return {
                    success: true,
                    message: 'If an account exists for this email, you will receive reset instructions shortly.'
                };
            }

            // Send email with OTP
            await emailService.sendPasswordResetEmail(email, otpResult.otp);

            logger.info('Password reset OTP sent', { email, ip: data.ip_address });

            return {
                success: true,
                message: 'If an account exists for this email, you will receive reset instructions shortly.'
            };
        } catch (error: any) {
            logger.error('Password reset request error', { error: error.message });
            return {
                success: true, // Always return success for security
                message: 'If an account exists for this email, you will receive reset instructions shortly.'
            };
        }
    }

    /**
     * Step 2: Verify OTP for password reset
     */
    async verifyOTP(data: PasswordResetVerify): Promise<{ success: boolean; token: string; message: string }> {
        try {
            const email = data.email.toLowerCase().trim();

            // Verify OTP via OTP service
            const verifyResult = await otpService.verifyOTP(
                email,
                data.otp,
                'password_reset'
            );

            if (!verifyResult.success) {
                logger.warn('Password reset OTP verification failed', { 
                    email, 
                    error: verifyResult.error,
                    attemptsRemaining: verifyResult.attemptsRemaining 
                });

                throw new Error(verifyResult.error || 'Invalid or expired OTP');
            }

            // Generate a one-time reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

            // Store reset token
            await pool.query(
                `INSERT INTO password_reset_tokens (email, token, otp_code, expires_at)
                 VALUES ($1, $2, $3, $4)`,
                [email, resetToken, data.otp, expiresAt]
            );

            logger.info('Password reset OTP verified', { email });

            return {
                success: true,
                token: resetToken,
                message: 'OTP verified successfully. You can now reset your password.'
            };
        } catch (error: any) {
            logger.error('Password reset OTP verification error', { error: error.message });
            throw error;
        }
    }

    /**
     * Step 3: Complete password reset
     */
    async completeReset(data: PasswordResetComplete): Promise<{ success: boolean; message: string }> {
        const client = await pool.connect();
        try {
            const email = data.email.toLowerCase().trim();

            await client.query('BEGIN');

            // Verify reset token exists and is valid
            const tokenResult = await client.query(
                `SELECT * FROM password_reset_tokens
                 WHERE email = $1 AND token = $2 AND otp_code = $3
                 AND used = false AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`,
                [email, data.otp, data.otp] // Using OTP as token identifier
            );

            if (tokenResult.rows.length === 0) {
                throw new Error('Invalid or expired reset token');
            }

            // Hash new password
            const bcrypt = await import('bcrypt');
            const { BCRYPT_ROUNDS } = await import('../config/security');
            const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);

            // Update user password
            await client.query(
                'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
                [passwordHash, email]
            );

            // Mark reset token as used
            await client.query(
                'UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE token_id = $1',
                [tokenResult.rows[0].token_id]
            );

            // Invalidate all refresh tokens (force re-login)
            await client.query(
                'UPDATE refresh_tokens SET revoked = true, revoked_at = NOW() WHERE user_id IN (SELECT user_id FROM users WHERE email = $1)',
                [email]
            );

            await client.query('COMMIT');

            // Log security event
            logger.info('Password reset completed', { 
                email,
                action: 'password_reset_complete',
                timestamp: new Date().toISOString()
            });

            // Send confirmation email
            await emailService.sendPasswordResetConfirmation(email);

            return {
                success: true,
                message: 'Your password has been reset successfully. Please login with your new password.'
            };
        } catch (error: any) {
            await client.query('ROLLBACK');
            logger.error('Password reset completion error', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Resend OTP for password reset
     */
    async resendOTP(email: string): Promise<{ success: boolean; message: string }> {
        try {
            const normalizedEmail = email.toLowerCase().trim();

            // Check if user exists
            const userResult = await pool.query(
                'SELECT user_id FROM users WHERE email = $1 AND email IS NOT NULL',
                [normalizedEmail]
            );

            // Always return success to prevent enumeration
            if (userResult.rows.length === 0) {
                return {
                    success: true,
                    message: 'If an account exists for this email, you will receive reset instructions shortly.'
                };
            }

            // Check rate limiting
            const rateLimit = await this.checkRateLimit(normalizedEmail);
            if (!rateLimit.allowed) {
                return {
                    success: true,
                    message: `Please wait ${rateLimit.waitSeconds} seconds before requesting another code.`
                };
            }

            // Generate new OTP
            const otpResult = await otpService.createOTP(normalizedEmail, 'password_reset');

            if (!otpResult.success || !otpResult.otp) {
                return {
                    success: true,
                    message: 'If an account exists for this email, you will receive reset instructions shortly.'
                };
            }

            // Send email
            await emailService.sendPasswordResetEmail(normalizedEmail, otpResult.otp);

            logger.info('Password reset OTP resent', { email: normalizedEmail });

            return {
                success: true,
                message: 'If an account exists for this email, you will receive reset instructions shortly.'
            };
        } catch (error: any) {
            logger.error('Password reset resend error', { error: error.message });
            return {
                success: true,
                message: 'If an account exists for this email, you will receive reset instructions shortly.'
            };
        }
    }

    /**
     * Check rate limiting for password reset requests
     */
    private async checkRateLimit(email: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
        try {
            const windowStart = new Date(Date.now() - this.RATE_LIMIT_WINDOW_MS);

            const result = await pool.query(
                `SELECT COUNT(*) as count, MAX(created_at) as last_request
                 FROM password_reset_tokens
                 WHERE email = $1 AND created_at > $2`,
                [email, windowStart]
            );

            const count = parseInt(result.rows[0].count);
            
            if (count >= this.RATE_LIMIT_MAX) {
                const lastRequest = new Date(result.rows[0].last_request);
                const waitUntil = new Date(lastRequest.getTime() + this.RATE_LIMIT_WINDOW_MS);
                const waitSeconds = Math.ceil((waitUntil.getTime() - Date.now()) / 1000);

                return {
                    allowed: false,
                    waitSeconds: Math.max(0, waitSeconds)
                };
            }

            return { allowed: true };
        } catch (error: any) {
            logger.error('Rate limit check error', { error: error.message });
            return { allowed: true }; // Fail open to prevent locking out legitimate users
        }
    }
}

export const passwordResetService = new PasswordResetService();
