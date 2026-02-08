import { Router } from 'express';
import { register, login, refreshToken, logout, deleteAccount, checkDeletionEligibility, registerWithEmail, verifyEmailOTP, resendOTP } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.middleware';
import { validate, loginSchema, registerCustomerSchema, registerGarageSchema } from '../middleware/validation.middleware';

const router = Router();

// Apply rate limiting and validation to auth endpoints
router.post('/register', registerLimiter, validate(registerCustomerSchema), register);
router.post('/register/garage', registerLimiter, validate(registerGarageSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/refresh', loginLimiter, refreshToken);
router.post('/logout', authenticate, logout);
router.get('/deletion-eligibility', authenticate, checkDeletionEligibility);
router.delete('/delete-account', authenticate, deleteAccount);

// Email OTP Registration (NEW)
router.post('/register-with-email', registerLimiter, registerWithEmail);
router.post('/verify-email-otp', registerLimiter, verifyEmailOTP);
router.post('/resend-otp', registerLimiter, resendOTP);

export default router;

