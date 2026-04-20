"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleAvailability = exports.getMyStats = exports.uploadDeliveryProof = exports.updateAssignmentStatus = exports.updateMyLocation = exports.getAssignmentDetails = exports.getMyAssignments = exports.getMyProfile = void 0;
const driver_service_1 = require("../services/driver.service");
// ============================================================================
// DRIVER PROFILE
// ============================================================================
const getMyProfile = async (req, res) => {
    try {
        const driver = await driver_service_1.driverService.getMyProfile(req.user.userId);
        if (!driver) {
            return res.status(404).json({ error: 'Driver profile not found' });
        }
        res.json({ driver });
    }
    catch (err) {
        console.error('getMyProfile Error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.getMyProfile = getMyProfile;
// ============================================================================
// ASSIGNMENTS
// ============================================================================
const getMyAssignments = async (req, res) => {
    try {
        const assignments = await driver_service_1.driverService.getMyAssignments(req.user.userId, req.query.status);
        res.json({
            assignments,
            count: assignments.length
        });
    }
    catch (err) {
        console.error('getMyAssignments Error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.getMyAssignments = getMyAssignments;
const getAssignmentDetails = async (req, res) => {
    try {
        const assignment = await driver_service_1.driverService.getAssignmentDetails(req.user.userId, req.params.assignment_id);
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found or not yours' });
        }
        res.json({ assignment });
    }
    catch (err) {
        console.error('getAssignmentDetails Error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.getAssignmentDetails = getAssignmentDetails;
// ============================================================================
// LOCATION TRACKING
// ============================================================================
const updateMyLocation = async (req, res) => {
    try {
        const { lat, lng, accuracy, heading, speed } = req.body;
        const result = await driver_service_1.driverService.updateMyLocation(req.user.userId, parseFloat(lat), parseFloat(lng), accuracy, heading, speed);
        res.json(result);
    }
    catch (err) {
        console.error('updateMyLocation Error:', err);
        if (err.message === 'Driver profile not found') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};
exports.updateMyLocation = updateMyLocation;
// ============================================================================
// STATUS UPDATES
// ============================================================================
const updateAssignmentStatus = async (req, res) => {
    try {
        const { status, notes, failure_reason } = req.body;
        const result = await driver_service_1.driverService.updateAssignmentStatus(req.user.userId, req.params.assignment_id, status, notes, failure_reason);
        res.json(result);
    }
    catch (err) {
        console.error('updateAssignmentStatus Error:', err);
        if (err.message.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        if (err.message.includes('Cannot transition')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};
exports.updateAssignmentStatus = updateAssignmentStatus;
const uploadDeliveryProof = async (req, res) => {
    try {
        const { photo_base64, signature_base64, notes } = req.body;
        const result = await driver_service_1.driverService.uploadProof(req.user.userId, req.params.assignment_id, photo_base64, signature_base64, notes);
        res.json(result);
    }
    catch (err) {
        console.error('uploadDeliveryProof Error:', err);
        if (err.message.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};
exports.uploadDeliveryProof = uploadDeliveryProof;
// ============================================================================
// DRIVER STATS
// ============================================================================
const getMyStats = async (req, res) => {
    try {
        const stats = await driver_service_1.driverService.getMyStats(req.user.userId);
        if (!stats) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        res.json({ stats });
    }
    catch (err) {
        console.error('getMyStats Error:', err);
        res.status(500).json({ error: err.message });
    }
};
exports.getMyStats = getMyStats;
const toggleAvailability = async (req, res) => {
    try {
        const result = await driver_service_1.driverService.toggleAvailability(req.user.userId, req.body.status);
        res.json(result);
    }
    catch (err) {
        console.error('toggleAvailability Error:', err);
        if (err.message.includes('Cannot go offline')) {
            return res.status(400).json({ error: err.message });
        }
        if (err.message === 'Driver not found') {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: err.message });
    }
};
exports.toggleAvailability = toggleAvailability;
