/**
 * Feature Flags Routes — Admin API for flag management
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { getAllFlags, getFlag, updateFlag, setRolloutPercentage } from '../services/featureFlags.service';

const router = Router();

// All routes require operations role
router.use(authenticate, requireRole('operations'));

// GET /api/feature-flags - List all flags
router.get('/', (_req: Request, res: Response) => {
    res.json({ flags: getAllFlags() });
});

// GET /api/feature-flags/:name - Get specific flag
router.get('/:name', (req: Request, res: Response) => {
    const flag = getFlag(req.params.name);
    if (!flag) {
        return res.status(404).json({ error: 'Flag not found' });
    }
    res.json({ flag });
});

// PATCH /api/feature-flags/:name - Update flag
router.patch('/:name', (req: Request, res: Response) => {
    const { enabled, rolloutPercentage, enabledUserIds, disabledUserIds } = req.body;

    const success = updateFlag(req.params.name, {
        enabled,
        rolloutPercentage,
        enabledUserIds,
        disabledUserIds
    });

    if (!success) {
        return res.status(404).json({ error: 'Flag not found' });
    }

    res.json({ success: true, flag: getFlag(req.params.name) });
});

// POST /api/feature-flags/:name/rollout - Set rollout percentage
router.post('/:name/rollout', (req: Request, res: Response) => {
    const { percentage } = req.body;

    if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
        return res.status(400).json({ error: 'Percentage must be between 0 and 100' });
    }

    const success = setRolloutPercentage(req.params.name, percentage);
    if (!success) {
        return res.status(404).json({ error: 'Flag not found' });
    }

    res.json({
        success: true,
        message: `Rollout set to ${percentage}%`,
        flag: getFlag(req.params.name)
    });
});

export default router;
