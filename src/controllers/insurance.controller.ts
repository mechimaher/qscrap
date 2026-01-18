import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { getReadPool, getWritePool } from '../config/db';
import { getErrorMessage } from '../types';
import { createNotification } from '../services/notification.service';
import logger from '../utils/logger';
import {
    InsuranceClaimService,
    MOIReportService,
    InsuranceAnalyticsService,
    InsuranceCompanyService
} from '../services/insurance';

// Initialize services
const claimService = new InsuranceClaimService(getReadPool(), getWritePool());
const moiService = new MOIReportService(getReadPool(), getWritePool());
const analyticsService = new InsuranceAnalyticsService(getReadPool());
const companyService = new InsuranceCompanyService(getReadPool());

// ============================================
// CLAIM MANAGEMENT
// ============================================

export const createClaim = async (req: AuthRequest, res: Response) => {
    const agentId = req.user!.userId;
    const params = { ...req.body, agentId };

    try {
        const result = await claimService.createClaim(params);
        res.status(201).json(result);
    } catch (err) {
        logger.error('[INSURANCE] createClaim error', { error: getErrorMessage(err) });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const getMyClaims = async (req: AuthRequest, res: Response) => {
    const agentId = req.user!.userId;

    try {
        const claims = await claimService.getMyClaims(agentId);
        res.json({ claims });
    } catch (err) {
        logger.error('[INSURANCE] getMyClaims error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getPendingApprovals = async (req: AuthRequest, res: Response) => {
    const agentId = req.user!.userId;

    try {
        const approvals = await claimService.getPendingApprovals(agentId);
        res.json({ approvals });
    } catch (err) {
        logger.error('[INSURANCE] getPendingApprovals error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const approveClaim = async (req: AuthRequest, res: Response) => {
    const { claim_id } = req.params;
    const { notes, approved_source } = req.body;
    const agentId = req.user!.userId;

    try {
        const result = await claimService.approveClaim(claim_id, agentId, notes, approved_source);

        await createNotification({
            userId: agentId,
            type: 'claim_approved',
            title: 'Claim Approved ✅',
            message: `Claim ${result.claim_reference} has been approved`,
            data: { claim_id, claim_reference: result.claim_reference },
            target_role: 'insurance_agent'
        });

        res.json(result);
    } catch (err) {
        logger.error('[INSURANCE] approveClaim error', { error: getErrorMessage(err) });
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const rejectClaim = async (req: AuthRequest, res: Response) => {
    const { claim_id } = req.params;
    const { reason } = req.body;
    const agentId = req.user!.userId;

    try {
        const result = await claimService.rejectClaim(claim_id, agentId, reason);

        await createNotification({
            userId: agentId,
            type: 'claim_rejected',
            title: 'Claim Rejected',
            message: `Claim ${result.claim_reference} has been rejected`,
            data: { claim_id, claim_reference: result.claim_reference, reason },
            target_role: 'insurance_agent'
        });

        res.json(result);
    } catch (err) {
        logger.error('[INSURANCE] rejectClaim error', { error: getErrorMessage(err) });
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const getApprovedOrders = async (req: AuthRequest, res: Response) => {
    const agentId = req.user!.userId;

    try {
        const orders = await claimService.getApprovedOrders(agentId);
        res.json({ orders });
    } catch (err) {
        logger.error('[INSURANCE] getApprovedOrders error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const submitToInsurance = async (req: AuthRequest, res: Response) => {
    const garageId = req.user!.userId;
    const params = { ...req.body, garageId };

    try {
        const result = await claimService.submitToInsurance(params);

        await createNotification({
            userId: garageId,
            type: 'insurance_claim_submitted',
            title: 'Claim Submitted 📋',
            message: `Insurance claim ${result.claim_reference} submitted successfully`,
            data: { claim_id: result.claim_id, claim_reference: result.claim_reference },
            target_role: 'garage'
        });

        res.status(201).json(result);
    } catch (err) {
        logger.error('[INSURANCE] submitToInsurance error', { error: getErrorMessage(err) });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// MOI REPORT MANAGEMENT
// ============================================

export const uploadMOIReport = async (req: AuthRequest, res: Response) => {
    const createdBy = req.user!.userId;
    const params = { ...req.body, createdBy };

    try {
        const result = await moiService.uploadMOIReport(params);
        res.status(201).json(result);
    } catch (err) {
        logger.error('[INSURANCE] uploadMOIReport error', { error: getErrorMessage(err) });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

export const getMOIReport = async (req: AuthRequest, res: Response) => {
    const { claim_id } = req.params;

    try {
        const report = await moiService.getMOIReport(claim_id);
        res.json({ report });
    } catch (err) {
        logger.error('[INSURANCE] getMOIReport error', { error: getErrorMessage(err) });
        if (err instanceof Error && err.message.includes('not found')) {
            return res.status(404).json({ error: 'MOI report not found' });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const verifyMOIReport = async (req: AuthRequest, res: Response) => {
    const { report_id } = req.params;
    const { verified, notes } = req.body;

    try {
        const result = await moiService.verifyMOIReport(report_id, verified, notes);
        res.json(result);
    } catch (err) {
        logger.error('[INSURANCE] verifyMOIReport error', { error: getErrorMessage(err) });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// ANALYTICS & SEARCH
// ============================================

export const searchParts = async (req: AuthRequest, res: Response) => {
    try {
        const result = await analyticsService.searchParts(req.query);
        res.json(result);
    } catch (err) {
        logger.error('[INSURANCE] searchParts error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const priceCompare = async (req: AuthRequest, res: Response) => {
    try {
        const result = await analyticsService.priceCompare(req.query);
        res.json(result);
    } catch (err) {
        logger.error('[INSURANCE] priceCompare error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const trackClaim = async (req: AuthRequest, res: Response) => {
    const { claim_id } = req.params;

    try {
        const result = await analyticsService.trackClaim(claim_id);
        res.json(result);
    } catch (err) {
        logger.error('[INSURANCE] trackClaim error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getClaimPhotos = async (req: AuthRequest, res: Response) => {
    const { claim_id } = req.params;

    try {
        const result = await analyticsService.getClaimPhotos(claim_id);
        res.json(result);
    } catch (err) {
        logger.error('[INSURANCE] getClaimPhotos error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getHistoryReport = async (req: AuthRequest, res: Response) => {
    const { vin_number } = req.params;

    try {
        const result = await analyticsService.getHistoryReport(vin_number);
        res.json(result);
    } catch (err) {
        logger.error('[INSURANCE] getHistoryReport error', { error: getErrorMessage(err) });
        res.status(400).json({ error: getErrorMessage(err) });
    }
};

// ============================================
// INSURANCE COMPANIES
// ============================================

export const getInsuranceCompanies = async (req: AuthRequest, res: Response) => {
    try {
        const companies = await companyService.getInsuranceCompanies();
        res.json({ companies });
    } catch (err) {
        logger.error('[INSURANCE] getInsuranceCompanies error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
