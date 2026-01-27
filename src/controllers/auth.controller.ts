import { Request, Response } from 'express';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';
import logger from '../utils/logger';
import { catchAsync } from '../utils/catchAsync';
import { AuthService } from '../services/auth';
import { AccountDeletionService } from '../services/auth/account-deletion.service';
import { otpService } from '../services/otp.service';
import { emailService } from '../services/email.service';

const authService = new AuthService(pool);
const accountDeletionService = new AccountDeletionService(pool);

// Qatar phone number validation
const isValidPhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s-]/g, '');
    return /^(\+?974)?[3-7]\d{7}$/.test(cleaned);
};

export const register = catchAsync(async (req: Request, res: Response) => {
    const { phone_number, password, user_type, full_name, garage_name, address, supplier_type, specialized_brands, all_brands, location_lat, location_lng } = req.body;

    if (!phone_number || !password || !user_type) return res.status(400).json({ error: 'Missing required fields: phone_number, password, user_type' });
    if (!isValidPhoneNumber(phone_number)) return res.status(400).json({ error: 'Invalid phone number format', hint: 'Use Qatar format: +974XXXXXXXX or 8-digit local number' });
    if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    if (!['customer', 'garage'].includes(user_type)) return res.status(400).json({ error: 'Invalid user_type. Must be "customer" or "garage"' });

    const exists = await authService.checkUserExists(phone_number);
    if (exists) return res.status(400).json({ error: 'User with this phone number already exists' });

    if (user_type === 'garage' && !garage_name) return res.status(400).json({ error: 'Garage name is required for garage registration' });

    let validLat: number | undefined, validLng: number | undefined;
    if (location_lat !== undefined && location_lng !== undefined) {
        const lat = parseFloat(location_lat), lng = parseFloat(location_lng);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            validLat = lat; validLng = lng;
            if (lat < 24.4 || lat > 26.2 || lng < 50.7 || lng > 51.7) logger.warn('Garage location outside Qatar bounds', { lat, lng });
        }
    }

    const result = await authService.registerUser({ phone_number, password, user_type, full_name, garage_name, address, supplier_type, specialized_brands, all_brands, location_lat: validLat, location_lng: validLng });
    res.status(201).json({ token: result.token, userId: result.userId, userType: user_type });
});

export const login = catchAsync(async (req: Request, res: Response) => {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) return res.status(400).json({ error: 'Phone number and password are required' });

    try {
        const result = await authService.login(phone_number, password);
        res.json(result);
    } catch (err) {
        const message = getErrorMessage(err);
        if (message === 'Invalid credentials') return res.status(401).json({ error: message });
        if (message === 'Account deactivated') return res.status(403).json({ error: message, message: 'Your account has been deactivated. Please contact support.' });
        if (message.startsWith('Account suspended') || message === 'Account suspended') return res.status(403).json({ error: 'Account suspended', message });
        if (message === 'pending_approval') return res.status(403).json({ error: 'pending_approval', message: 'Your account is pending approval.', status: 'pending' });
        if (message.startsWith('application_rejected:')) return res.status(403).json({ error: 'application_rejected', message: message.split(':')[1], status: 'rejected' });
        throw err;
    }
});

export const deleteAccount = catchAsync(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    logger.info('Deleting user account', { userId: req.user.userId });
    try {
        await authService.deleteAccount(req.user.userId);
        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        if (getErrorMessage(err) === 'User not found') return res.status(404).json({ error: 'User not found' });
        throw err;
    }
});

/**
 * Check if user account can be deleted
 * Returns blockers if there are pending business items (orders, tickets, disputes)
 */
export const checkDeletionEligibility = catchAsync(async (req: AuthRequest, res: Response) => {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await accountDeletionService.checkDeletionEligibility(req.user.userId);
    res.json(result);
});

/**
 * Register customer with email (Step 1 of 2)
 * Creates pending account and sends OTP email
 */
export const registerWithEmail = catchAsync(async (req: Request, res: Response) => {
    const { full_name, email, phone_number, password } = req.body;

    // Validation
    if (!full_name || !email || !phone_number || !password) {
        return res.status(400).json({ error: 'Missing required fields: full_name, email, phone_number, password' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    // Phone validation
    if (!isValidPhoneNumber(phone_number)) {
        return res.status(400).json({
            error: 'Invalid phone number format',
            hint: 'Use Qatar format: +974XXXXXXXX or 8-digit local number'
        });
    }

    // Password length
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const userExists = await authService.checkUserExists(phone_number);
    if (userExists) {
        return res.status(400).json({ error: 'User with this phone number already exists' });
    }

    // Check if email already in use
    const emailCheck = await pool.query(
        'SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
    );
    if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email address already in use' });
    }

    // Create OTP
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const otpResult = await otpService.createOTP(email, 'registration', ipAddress, userAgent);

    if (!otpResult.success) {
        return res.status(429).json({
            error: otpResult.error,
            waitSeconds: otpResult.waitSeconds
        });
    }

    // Send OTP email
    const emailSent = await emailService.sendOTPEmail(email, otpResult.otp!, full_name);

    if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    logger.info('[Auth] OTP email sent for registration', { email, phone_number });

    res.status(200).json({
        success: true,
        message: 'Verification code sent to your email',
        email,
        expiresIn: 600 // 10 minutes
    });
});

/**
 * Verify email OTP and complete registration (Step 2 of 2)
 */
export const verifyEmailOTP = catchAsync(async (req: Request, res: Response) => {
    const { email, otp, full_name, phone_number, password } = req.body;

    // Validation
    if (!email || !otp || !full_name || !phone_number || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify OTP
    const verifyResult = await otpService.verifyOTP(email, otp, 'registration');

    if (!verifyResult.success) {
        return res.status(400).json({
            error: verifyResult.error,
            attemptsRemaining: verifyResult.attemptsRemaining
        });
    }

    // Register the user
    try {
        const result = await authService.registerUser({
            phone_number,
            password,
            user_type: 'customer',
            full_name,
            email: email.toLowerCase().trim()
        });

        // Invalidate all other OTPs for this email
        await otpService.invalidateOTPs(email, 'registration');

        logger.info('[Auth] Email verified and user registered', { userId: result.userId, email });

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token: result.token,
            userId: result.userId,
            userType: 'customer',
            emailVerified: true
        });
    } catch (error) {
        logger.error('[Auth] Registration failed after OTP verification', { error, email });
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

/**
 * Resend OTP email
 */
export const resendOTP = catchAsync(async (req: Request, res: Response) => {
    const { email, full_name } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Create new OTP
    const otpResult = await otpService.createOTP(email, 'registration', ipAddress, userAgent);

    if (!otpResult.success) {
        return res.status(429).json({
            error: otpResult.error,
            waitSeconds: otpResult.waitSeconds
        });
    }

    // Send OTP email
    const emailSent = await emailService.sendOTPEmail(email, otpResult.otp!, full_name);

    if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    logger.info('[Auth] OTP email resent', { email });

    res.status(200).json({
        success: true,
        message: 'Verification code resent to your email',
        expiresIn: 600
    });
});
