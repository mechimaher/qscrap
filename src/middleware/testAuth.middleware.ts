import { Request, Response, NextFunction } from 'express';

/**
 * Very light auth stub for tests:
 * Expects Authorization: Bearer test-<userId>-<role>
 */
export const testAuth = (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer test-')) {
        const token = header.replace('Bearer test-', '');
        const lastDashIndex = token.lastIndexOf('-');
        if (lastDashIndex !== -1) {
            const userId = token.substring(0, lastDashIndex);
            const role = token.substring(lastDashIndex + 1);
            (req as any).user = { userId, role: role || 'customer', userType: role || 'customer' };
        } else {
            (req as any).user = { userId: token, role: 'customer', userType: 'customer' };
        }
    }
    next();
};
