
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { driverService } from '../services/driver.service';
import { getErrorMessage } from '../types';
import logger from '../utils/logger';
import { getIO } from '../utils/socketIO';

interface AssignmentParams {
    assignment_id?: string;
}

interface AssignmentQuery {
    status?: string | string[];
}

interface RejectAssignmentBody {
    rejection_reason?: string;
}

interface UpdateLocationBody {
    lat?: number | string;
    lng?: number | string;
    accuracy?: number | string | null;
    heading?: number | string | null;
    speed?: number | string | null;
}

interface UpdateAssignmentStatusBody {
    status?: string;
    notes?: string;
    failure_reason?: string;
}

interface UploadProofBody {
    photo_base64?: string;
    signature_base64?: string;
    notes?: string;
    payment_method?: string;
}

interface ToggleAvailabilityBody {
    status?: string;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === 'object' && value !== null;

const toStringValue = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0];
    }
    return undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const stringValue = toStringValue(value);
    if (!stringValue) {
        return undefined;
    }
    const parsed = Number.parseFloat(stringValue);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const getUserId = (req: AuthRequest): string | null => req.user?.userId ?? null;

const getAssignmentId = (req: AuthRequest): string | undefined => {
    const params = req.params as unknown as AssignmentParams;
    return toStringValue(params.assignment_id);
};

const logControllerError = (context: string, err: unknown): string => {
    const errorMessage = getErrorMessage(err);
    logger.error(context, { error: errorMessage });
    return errorMessage;
};

// ============================================================================
// DRIVER PROFILE
// ============================================================================

export const getMyProfile = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const driver = await driverService.getMyProfile(userId);
        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }
        res.json({ driver });
    } catch (err) {
        const errorMessage = logControllerError('getMyProfile Error', err);
        res.status(500).json({ error: errorMessage });
    }
};

// ============================================================================
// ASSIGNMENTS
// ============================================================================

export const getMyAssignments = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const query = req.query as unknown as AssignmentQuery;
        const status = toStringValue(query.status);
        const assignments = await driverService.getMyAssignments(userId, status);
        res.json({
            assignments,
            count: assignments.length
        });
    } catch (err) {
        const errorMessage = logControllerError('getMyAssignments Error', err);
        res.status(500).json({ error: errorMessage });
    }
};

export const getAssignmentDetails = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const assignmentId = getAssignmentId(req);
    if (!assignmentId) {
        return res.status(400).json({ error: 'Assignment id is required' });
    }

    try {
        const assignment = await driverService.getAssignmentDetails(userId, assignmentId);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found or not yours' });
        }
        res.json({ assignment });
    } catch (err) {
        const errorMessage = logControllerError('getAssignmentDetails Error', err);
        res.status(500).json({ error: errorMessage });
    }
};

export const acceptAssignment = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const assignmentId = getAssignmentId(req);
    if (!assignmentId) {
        return res.status(400).json({ error: 'Assignment id is required' });
    }

    try {
        const result = await driverService.acceptAssignment(userId, assignmentId);

        const io = getIO();
        if (io) {
            io.to(`driver_${userId}`).emit('assignment_accepted', {
                assignment_id: assignmentId,
                user_id: userId
            });
        }

        res.json(result);
    } catch (err) {
        const errorMessage = logControllerError('acceptAssignment Error', err);
        if (errorMessage.includes('not found')) {
            return res.status(404).json({ error: errorMessage });
        }
        if (errorMessage.includes('Cannot accept assignment')) {
            return res.status(400).json({ error: errorMessage });
        }
        res.status(500).json({ error: errorMessage });
    }
};

export const rejectAssignment = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const assignmentId = getAssignmentId(req);
    if (!assignmentId) {
        return res.status(400).json({ error: 'Assignment id is required' });
    }

    const body = req.body as unknown as RejectAssignmentBody;
    const rejectionReason = toStringValue(body.rejection_reason);

    try {
        const result = await driverService.rejectAssignment(
            userId,
            assignmentId,
            rejectionReason
        );

        const io = getIO();
        if (io) {
            io.to(`driver_${userId}`).emit('assignment_rejected', {
                assignment_id: assignmentId,
                user_id: userId,
                reason: rejectionReason
            });

            io.to('operations').emit('assignment_rejected_by_driver', {
                assignment_id: assignmentId,
                driver_id: userId,
                reason: rejectionReason
            });
        }

        res.json(result);
    } catch (err) {
        const errorMessage = logControllerError('rejectAssignment Error', err);
        if (errorMessage.includes('not found')) {
            return res.status(404).json({ error: errorMessage });
        }
        if (errorMessage.includes('Cannot reject assignment')) {
            return res.status(400).json({ error: errorMessage });
        }
        res.status(500).json({ error: errorMessage });
    }
};

// ============================================================================
// LOCATION TRACKING
// ============================================================================

export const updateMyLocation = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const body = req.body as unknown as UpdateLocationBody;
    const lat = toOptionalNumber(body.lat);
    const lng = toOptionalNumber(body.lng);
    const accuracy = toOptionalNumber(body.accuracy);
    const heading = toOptionalNumber(body.heading);
    const speed = toOptionalNumber(body.speed);

    if (lat === undefined || lng === undefined) {
        return res.status(400).json({ error: 'Valid lat and lng are required' });
    }

    try {
        const result = await driverService.updateMyLocation(
            userId,
            lat,
            lng,
            accuracy,
            heading,
            speed
        );
        res.json(result);
    } catch (err) {
        const errorMessage = logControllerError('updateMyLocation Error', err);
        if (errorMessage === 'Driver profile not found') {
            return res.status(404).json({ error: errorMessage });
        }
        res.status(500).json({ error: errorMessage });
    }
};

// ============================================================================
// STATUS UPDATES
// ============================================================================

export const updateAssignmentStatus = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const assignmentId = getAssignmentId(req);
    if (!assignmentId) {
        return res.status(400).json({ error: 'Assignment id is required' });
    }

    const body = req.body as unknown as UpdateAssignmentStatusBody;
    const status = toStringValue(body.status);
    const notes = toStringValue(body.notes);
    const failureReason = toStringValue(body.failure_reason);

    if (!status) {
        return res.status(400).json({ error: 'status is required' });
    }

    try {
        const result = await driverService.updateAssignmentStatus(
            userId,
            assignmentId,
            status,
            notes,
            failureReason
        );
        res.json(result);
    } catch (err) {
        const errorMessage = logControllerError('updateAssignmentStatus Error', err);
        if (errorMessage.includes('not found')) {
            return res.status(404).json({ error: errorMessage });
        }
        if (errorMessage.includes('Cannot transition')) {
            return res.status(400).json({ error: errorMessage });
        }
        res.status(500).json({ error: errorMessage });
    }
};

export const uploadDeliveryProof = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const assignmentId = getAssignmentId(req);
    if (!assignmentId) {
        return res.status(400).json({ error: 'Assignment id is required' });
    }

    const body = req.body as unknown as UploadProofBody;
    const photoBase64 = toStringValue(body.photo_base64);
    const signatureBase64 = toStringValue(body.signature_base64);
    const notes = toStringValue(body.notes);
    const paymentMethod = toStringValue(body.payment_method);

    if (!photoBase64) {
        return res.status(400).json({ error: 'photo_base64 is required' });
    }

    try {
        const result = await driverService.uploadProof(
            userId,
            assignmentId,
            photoBase64,
            signatureBase64,
            notes,
            paymentMethod
        );
        res.json(result);
    } catch (err) {
        const errorMessage = logControllerError('uploadDeliveryProof Error', err);
        if (errorMessage.includes('not found')) {
            return res.status(404).json({ error: errorMessage });
        }
        res.status(500).json({ error: errorMessage });
    }
};

// ============================================================================
// DRIVER STATS
// ============================================================================

export const getMyStats = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const stats = await driverService.getMyStats(userId);
        if (!stats) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        res.json({ stats });
    } catch (err) {
        const errorMessage = logControllerError('getMyStats Error', err);
        res.status(500).json({ error: errorMessage });
    }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = isRecord(req.body) ? req.body : {};

    try {
        const driver = await driverService.updateProfile(userId, payload);
        res.json({
            success: true,
            message: 'Profile updated successfully',
            driver
        });
    } catch (err) {
        const errorMessage = logControllerError('updateProfile Error', err);
        res.status(500).json({ error: errorMessage });
    }
};

export const toggleAvailability = async (req: AuthRequest, res: Response) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const body = req.body as unknown as ToggleAvailabilityBody;
    const status = toStringValue(body.status);
    if (!status) {
        return res.status(400).json({ error: 'status is required' });
    }

    try {
        const result = await driverService.toggleAvailability(userId, status);

        const io = getIO();
        if (io) {
            io.to(`driver_${userId}`).emit('driver_status_changed', {
                status,
                user_id: userId
            });
        }

        res.json(result);
    } catch (err) {
        const errorMessage = logControllerError('toggleAvailability Error', err);
        if (errorMessage.includes('Cannot go offline')) {
            return res.status(400).json({ error: errorMessage });
        }
        if (errorMessage === 'Driver not found') {
            return res.status(404).json({ error: errorMessage });
        }
        res.status(500).json({ error: errorMessage });
    }
};
