import { Request, Response } from 'express';
import { getReadPool, getWritePool } from '../config/db';

const readPool = getReadPool();
const writePool = getWritePool();

// Get list of available service definitions
export const getServiceDefinitions = async (req: Request, res: Response) => {
    try {
        const { category } = req.query;
        let query = 'SELECT * FROM service_definitions WHERE is_active = true';
        const params: any[] = [];

        if (category) {
            query += ' AND category = $1';
            params.push(category);
        }

        query += ' ORDER BY category, name';

        const result = await readPool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching service definitions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create a new service request
export const createServiceRequest = async (req: Request, res: Response) => {
    const client = await writePool.connect();
    try {
        const { service_def_id, car_make, car_model, car_year, vin_number, location_lat, location_lng, address_text, description, preferred_schedule } = req.body;
        const userId = (req as any).user.user_id;

        // Extract image URLs from uploaded files
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        const images = files?.['images']?.map((file: any) => file.location || file.path) || [];

        await client.query('BEGIN');

        // Create the request
        const requestResult = await client.query(`
            INSERT INTO service_requests (
                customer_id, service_def_id, 
                car_make, car_model, car_year, vin_number,
                location_lat, location_lng, address_text,
                description, image_urls, preferred_schedule,
                status // default pending
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING request_id
        `, [
            userId, service_def_id,
            car_make, car_model, car_year, vin_number,
            location_lat, location_lng, address_text,
            description, images, preferred_schedule
        ]);

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Service request created successfully',
            request_id: requestResult.rows[0].request_id
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating service request:', error);
        res.status(500).json({ error: 'Failed to create service request' });
    } finally {
        client.release();
    }
};

// Get Customer's Service Requests
export const getMyServiceRequests = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.user_id;
        const result = await readPool.query(`
            SELECT sr.*, sd.name as service_name, sd.category,
                   (SELECT COUNT(*) FROM service_bids sb WHERE sb.request_id = sr.request_id) as bid_count
            FROM service_requests sr
            JOIN service_definitions sd ON sr.service_def_id = sd.service_def_id
            WHERE sr.customer_id = $1
            ORDER BY sr.created_at DESC
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching my service requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get Nearby Open Requests (For Providers) with Intelligent Routing
export const getNearbyRequests = async (req: Request, res: Response) => {
    try {
        const { lat, lng, radius_km = 50 } = req.query;

        // Convert input to floats
        const myLat = parseFloat(String(lat));
        const myLng = parseFloat(String(lng));
        const radKm = parseFloat(String(radius_km));

        // Intelligent Geo-Query using Haversine formula (6371 is Earth radius in km)
        // Order by distance ASC
        const result = await readPool.query(`
            SELECT sr.*, sd.name as service_name, sd.category,
                   u.full_name as customer_name,
                   (
                       6371 * acos(
                           cos(radians($1)) * cos(radians(sr.location_lat)) *
                           cos(radians(sr.location_lng) - radians($2)) +
                           sin(radians($1)) * sin(radians(sr.location_lat))
                       )
                   ) AS distance_km
            FROM service_requests sr
            JOIN service_definitions sd ON sr.service_def_id = sd.service_def_id
            JOIN users u ON sr.customer_id = u.user_id
            WHERE sr.status = 'pending'
            GROUP BY sr.request_id, sd.name, sd.category, u.full_name
            HAVING (
               6371 * acos(
                   cos(radians($1)) * cos(radians(sr.location_lat)) *
                   cos(radians(sr.location_lng) - radians($2)) +
                   sin(radians($1)) * sin(radians(sr.location_lat))
               )
            ) < $3
            ORDER BY distance_km ASC
            LIMIT 50
        `, [myLat, myLng, radKm]);

        // Add Estimated Time of Arrival (ETA) metadata
        // Assuming average city speed of 30 km/h + 5 mins prep
        const requestsWithETA = result.rows.map(req => ({
            ...req,
            estimated_time_arrival_mins: Math.round((req.distance_km / 30) * 60) + 5
        }));

        res.json(requestsWithETA);
    } catch (error) {
        console.error('Error fetching nearby requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Place a Bid on a Service Request
export const bidOnServiceRequest = async (req: Request, res: Response) => {
    try {
        const { request_id } = req.params;
        const { amount, notes, proposed_schedule } = req.body;
        const garageId = (req as any).user.user_id; // Garage/Provider User ID

        // Check active subscription logic here (reused from check_garage_can_bid trigger/function logic effectively)

        const result = await writePool.query(`
            INSERT INTO service_bids (request_id, garage_id, bid_amount, notes, proposed_schedule)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING bid_id
        `, [request_id, garageId, amount, notes, proposed_schedule]);

        // Update request status to 'bidding' if it was pending
        await writePool.query(`
            UPDATE service_requests SET status = 'bidding' 
            WHERE request_id = $1 AND status = 'pending'
        `, [request_id]);

        res.status(201).json({ message: 'Bid placed successfully', bid_id: result.rows[0].bid_id });
    } catch (error) {
        console.error('Error placing service bid:', error);
        res.status(500).json({ error: 'Failed to place bid' });
    }
};
