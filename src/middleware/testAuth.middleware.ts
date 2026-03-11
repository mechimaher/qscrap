import { Request, Response, NextFunction } from 'express';

/**
 * Very light auth stub for tests:
 * Expects Authorization: Bearer test-<userId>-<role>
 */
export const testAuth = (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer test-')) {
        const token = header.replace('Bearer test-', '');
        const [userId, role] = token.split('-');
        (req as any).user = { userId, role: role || 'customer', userType: role || 'customer' };
    }
    next();
};
