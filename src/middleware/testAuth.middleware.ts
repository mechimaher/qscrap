import { Request, Response, NextFunction } from 'express';

/**
 * Very light auth stub for tests:
 * Expects Authorization: Bearer test-<userId>-<role>
 */
export const testAuth = (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer test-')) {
        const token = header.replace('Bearer test-', '');
        const separatorIndex = token.lastIndexOf('-');
        if (separatorIndex > 0) {
            const userId = token.slice(0, separatorIndex);
            const role = token.slice(separatorIndex + 1) || 'customer';
            (req as any).user = {
                userId,
                id: userId,
                role,
                userType: role,
            };
        }
    }
    next();
};
