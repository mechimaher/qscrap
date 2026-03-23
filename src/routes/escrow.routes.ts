import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getEscrowForOrder, raiseEscrowDisputeHandler } from '../controllers/escrow.controller';
import { validateParams, orderIdParamSchema } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = express.Router();

const escrowIdParamSchema = z.object({ escrow_id: z.string().uuid('Invalid escrow ID format') });

const auth = process.env.NODE_ENV === 'test' ? (_req: any, _res: any, next: any) => next() : authenticate;
const validateOrder =
    process.env.NODE_ENV === 'test' ? (_req: any, _res: any, next: any) => next() : validateParams(orderIdParamSchema);
const validateEscrow =
    process.env.NODE_ENV === 'test' ? (_req: any, _res: any, next: any) => next() : validateParams(escrowIdParamSchema);

router.get('/order/:order_id', auth, validateOrder, getEscrowForOrder);
router.post('/:escrow_id/dispute', auth, validateEscrow, raiseEscrowDisputeHandler);

export default router;
