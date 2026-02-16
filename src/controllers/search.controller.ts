import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/db';
import { getErrorMessage } from '../types';
import { SearchService } from '../services/search';
import logger from '../utils/logger';

const searchService = new SearchService(pool);

export const universalSearch = async (req: AuthRequest, res: Response) => {
    const { q, type, limit = 10 } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {return res.json({ results: {} });}
    try {
        const results = await searchService.universalSearch(req.user!.userId, req.user!.userType, q.trim(), type as string, Math.min(Number(limit) || 10, 50));
        res.json({ results, query: q });
    } catch (err) {
        logger.error('Universal search error', { error: err });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getSearchSuggestions = async (req: AuthRequest, res: Response) => {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {return res.json({ suggestions: [] });}
    try {
        const suggestions = await searchService.getSuggestions(req.user!.userId, req.user!.userType, q.trim());
        res.json({ suggestions });
    } catch (err) {
        logger.error('Search suggestions error', { error: err });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
