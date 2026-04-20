"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleAvailabilitySchema = exports.uploadProofSchema = exports.updateStatusSchema = exports.updateLocationSchema = void 0;
const zod_1 = require("zod");
exports.updateLocationSchema = zod_1.z.object({
    lat: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform(val => parseFloat(val.toString())),
    lng: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).transform(val => parseFloat(val.toString())),
    accuracy: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().transform(val => val ? parseFloat(val.toString()) : null),
    heading: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().transform(val => val ? parseFloat(val.toString()) : null),
    speed: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().transform(val => val ? parseFloat(val.toString()) : null),
});
exports.updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['picked_up', 'in_transit', 'delivered', 'failed']),
    notes: zod_1.z.string().optional(),
    failure_reason: zod_1.z.string().optional(),
});
exports.uploadProofSchema = zod_1.z.object({
    photo_base64: zod_1.z.string().min(1, "Photo is required"),
    signature_base64: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
});
exports.toggleAvailabilitySchema = zod_1.z.object({
    status: zod_1.z.enum(['available', 'offline']),
});
