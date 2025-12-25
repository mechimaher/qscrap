import express from 'express';
import * as addressController from '../controllers/address.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

router.use(authenticate);

router.get('/', addressController.getAddresses);
router.post('/', addressController.addAddress);
router.delete('/:address_id', addressController.deleteAddress);
router.put('/:address_id/default', addressController.setDefaultAddress);

export default router;
