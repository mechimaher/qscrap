
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { driverService } from '../services/driver.service';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';
// ============================================================================
// DRIVER PROFILE
// ============================================================================

export const getMyProfile = async (req: AuthRequest, res: Response) => {
    try {
        const driver = await driverService.getMyProfile(req.user!.userId);
        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }
        res.json({ driver });
    } catch (err) {
        logger.error('getMyProfile Error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================================================
// ASSIGNMENTS
// ============================================================================

export const getMyAssignments = async (req: AuthRequest, res: Response) => {
    try {
        const assignments = await driverService.getMyAssignments(req.user!.userId, req.query.status);
        res.json({
            assignments,
            count: assignments.length
        });
    } catch (err) {
        logger.error('getMyAssignments Error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const getAssignmentDetails = async (req: AuthRequest, res: Response) => {
    try {
        const assignment = await driverService.getAssignmentDetails(req.user!.userId, req.params.assignment_id);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found or not yours' });
        }
        res.json({ assignment });
    } catch (err) {
        logger.error('getAssignmentDetails Error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const acceptAssignment = async (req: AuthRequest, res: Response) => {
    try {
        const result = await driverService.acceptAssignment(req.user!.userId, req.params.assignment_id);

        // Real-time status sync
        const io = getIO();
        if (io) {
            io.to(`driver_${req.user!.userId}`).emit('assignment_accepted', {
                assignment_id: req.params.assignment_id,
                user_id: req.user!.userId
            });
        }

        res.json(result);
    } catch (err) {
        logger.error('acceptAssignment Error', { error: getErrorMessage(err) });
        if (getErrorMessage(err).includes('not found')) {
            return res.status(404).json({ error: getErrorMessage(err) });
        }
        if (getErrorMessage(err).includes('Cannot accept assignment')) {
            return res.status(400).json({ error: getErrorMessage(err) });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const rejectAssignment = async (req: AuthRequest, res: Response) => {
    try {
        const { rejection_reason } = req.body;
        const result = await driverService.rejectAssignment(
            req.user!.userId,
            req.params.assignment_id,
            rejection_reason
        );

        // Real-time status sync
        const io = getIO();
        if (io) {
            io.to(`driver_${req.user!.userId}`).emit('assignment_rejected', {
                assignment_id: req.params.assignment_id,
                user_id: req.user!.userId,
                reason: rejection_reason
            });

            // Notify operations that assignment was rejected for reassignment
            io.to('operations').emit('assignment_rejected_by_driver', {
                assignment_id: req.params.assignment_id,
                driver_id: req.user!.userId,
                reason: rejection_reason
            });
        }

        res.json(result);
    } catch (err) {
        logger.error('rejectAssignment Error', { error: getErrorMessage(err) });
        if (getErrorMessage(err).includes('not found')) {
            return res.status(404).json({ error: getErrorMessage(err) });
        }
        if (getErrorMessage(err).includes('Cannot reject assignment')) {
            return res.status(400).json({ error: getErrorMessage(err) });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================================================
// LOCATION TRACKING
// ============================================================================

export const updateMyLocation = async (req: AuthRequest, res: Response) => {
    try {
        const { lat, lng, accuracy, heading, speed } = req.body;
        const result = await driverService.updateMyLocation(
            req.user!.userId,
            parseFloat(lat),
            parseFloat(lng),
            accuracy,
            heading,
            speed
        );
        res.json(result);
    } catch (err) {
        logger.error('updateMyLocation Error', { error: getErrorMessage(err) });
        if (getErrorMessage(err) === 'Driver profile not found') {
            return res.status(404).json({ error: getErrorMessage(err) });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================================================
// STATUS UPDATES
// ============================================================================

export const updateAssignmentStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { status, notes, failure_reason } = req.body;
        const result = await driverService.updateAssignmentStatus(
            req.user!.userId,
            req.params.assignment_id,
            status,
            notes,
            failure_reason
        );
        res.json(result);
    } catch (err) {
        logger.error('updateAssignmentStatus Error', { error: getErrorMessage(err) });
        if (getErrorMessage(err).includes('not found')) {
            return res.status(404).json({ error: getErrorMessage(err) });
        }
        if (getErrorMessage(err).includes('Cannot transition')) {
            return res.status(400).json({ error: getErrorMessage(err) });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const uploadDeliveryProof = async (req: AuthRequest, res: Response) => {
    try {
        const { photo_base64, signature_base64, notes } = req.body;
        const result = await driverService.uploadProof(
            req.user!.userId,
            req.params.assignment_id,
            photo_base64,
            signature_base64,
            notes
        );
        res.json(result);
    } catch (err) {
        logger.error('uploadDeliveryProof Error', { error: getErrorMessage(err) });
        if (getErrorMessage(err).includes('not found')) {
            return res.status(404).json({ error: getErrorMessage(err) });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

// ============================================================================
// DRIVER STATS
// ============================================================================

export const getMyStats = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await driverService.getMyStats(req.user!.userId);
        if (!stats) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        res.json({ stats });
    } catch (err) {
        logger.error('getMyStats Error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};


export const updateProfile = async (req: AuthRequest, res: Response) => {
    try {
        const driver = await driverService.updateProfile(req.user!.userId, req.body);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            driver
        });
    } catch (err) {
        logger.error('updateProfile Error', { error: getErrorMessage(err) });
        res.status(500).json({ error: getErrorMessage(err) });
    }
};

export const toggleAvailability = async (req: AuthRequest, res: Response) => {
    try {
        const result = await driverService.toggleAvailability(req.user!.userId, req.body.status);

        // Real-time status sync
        const io = getIO();
        if (io) {
            io.to(`driver_${req.user!.userId}`).emit('driver_status_changed', {
                status: req.body.status,
                user_id: req.user!.userId
            });
        }

        res.json(result);
    } catch (err) {
        logger.error('toggleAvailability Error', { error: getErrorMessage(err) });
        if (getErrorMessage(err).includes('Cannot go offline')) {
            return res.status(400).json({ error: getErrorMessage(err) });
        }
        if (getErrorMessage(err) === 'Driver not found') {
            return res.status(404).json({ error: getErrorMessage(err) });
        }
        res.status(500).json({ error: getErrorMessage(err) });
    }
};
