import { z } from 'zod';

export const updateLocationSchema = z.object({
    lat: z.union([z.string(), z.number()]).transform(val => parseFloat(val.toString())),
    lng: z.union([z.string(), z.number()]).transform(val => parseFloat(val.toString())),
    accuracy: z.union([z.string(), z.number()]).optional().transform(val => val ? parseFloat(val.toString()) : null),
    heading: z.union([z.string(), z.number()]).optional().transform(val => val ? parseFloat(val.toString()) : null),
    speed: z.union([z.string(), z.number()]).optional().transform(val => val ? parseFloat(val.toString()) : null),
});

export const updateStatusSchema = z.object({
    status: z.enum(['picked_up', 'in_transit', 'delivered', 'failed']),
    notes: z.string().optional(),
    failure_reason: z.string().optional(),
});

export const uploadProofSchema = z.object({
    photo_base64: z.string().min(1, "Photo is required"),
    signature_base64: z.string().optional(),
    notes: z.string().optional(),
});

export const toggleAvailabilitySchema = z.object({
    status: z.enum(['available', 'offline']),
});
