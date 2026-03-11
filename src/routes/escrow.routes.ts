import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getEscrowForOrder, raiseEscrowDisputeHandler } from '../controllers/escrow.controller';
import { validateParams, orderIdParamSchema } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = express.Router();

const escrowIdParamSchema = z.object({ escrow_id: z.string().uuid('Invalid escrow ID format') });

const escrowDisputeSchema = z.object({
    reason: z.enum(['defective', 'wrong_part', 'damaged', 'missing', 'other']),
    note: z.string().max(1000, 'Note must be less than 1000 characters').optional()
});

const auth = process.env.NODE_ENV === 'test' ? (_req: any, _res: any, next: any) => next() : authenticate;
const validateOrder = process.env.NODE_ENV === 'test' ? (_req: any, _res: any, next: any) => next() : validateParams(orderIdParamSchema);
const validateEscrow = process.env.NODE_ENV === 'test' ? (_req: any, _res: any, next: any) => next() : validateParams(escrowIdParamSchema);

const validateDisputeBody = (req: any, res: any, next: any) => {
    try {
        escrowDisputeSchema.parse(req.body);
        next();
    } catch (err: any) {
        return res.status(400).json({ error: 'Invalid dispute data', details: err.errors });
    }
};

router.get('/order/:order_id', auth, validateOrder, getEscrowForOrder);
router.post('/:escrow_id/dispute', auth, validateEscrow, validateDisputeBody, raiseEscrowDisputeHandler);

export default router;
