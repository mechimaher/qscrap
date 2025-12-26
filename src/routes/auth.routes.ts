import { Router } from 'express';
import { register, login, deleteAccount } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.middleware';
import { validate, loginSchema, registerCustomerSchema, registerGarageSchema } from '../middleware/validation.middleware';

const router = Router();

// Apply rate limiting and validation to auth endpoints
router.post('/register', registerLimiter, validate(registerCustomerSchema), register);
router.post('/register/garage', registerLimiter, validate(registerGarageSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.delete('/delete-account', authenticate, deleteAccount);

export default router;
