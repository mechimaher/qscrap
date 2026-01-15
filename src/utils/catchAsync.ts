import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async route handler to catch any errors and pass them to the global error middleware.
 * Use this to avoid repetitive try/catch blocks in controllers.
 */
export const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
