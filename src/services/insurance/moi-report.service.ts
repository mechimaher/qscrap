/**
 * MOI Report Service
 * Handles Ministry of Interior accident reports
 */
import { Pool } from 'pg';
import { MOIReportParams } from './types';
import { MOIReportNotFoundError } from './errors';

export class MOIReportService {
    constructor(private readPool: Pool, private writePool: Pool) { }

    /**
     * Upload MOI accident report for a claim
     */
    async uploadMOIReport(params: MOIReportParams): Promise<any> {
        const {
            claimId,
            reportNumber,
            accidentDate,
            policeStation,
            vehicleVin,
            vehicleRegistration,
            driverName,
            driverIdNumber,
            reportDocumentUrl,
            parsedData,
            createdBy
        } = params;

        // Verify claim exists
        const claimCheck = await this.readPool.query(
            'SELECT claim_id FROM insurance_claims WHERE claim_id = $1',
            [claimId]
        );

        if (claimCheck.rows.length === 0) {
            throw new Error('Claim not found');
        }

        const result = await this.writePool.query(`
            INSERT INTO moi_accident_reports (
                claim_id, report_number, accident_date, police_station,
                vehicle_vin, vehicle_registration, driver_name, driver_id_number,
                report_document_url, parsed_data, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            claimId, reportNumber, accidentDate, policeStation,
            vehicleVin, vehicleRegistration, driverName, driverIdNumber,
            reportDocumentUrl, parsedData ? JSON.stringify(parsedData) : null,
            createdBy
        ]);

        // Update claim to indicate MOI report attached
        await this.writePool.query(
            'UPDATE insurance_claims SET has_moi_report = true WHERE claim_id = $1',
            [claimId]
        );

        return {
            message: 'MOI report uploaded successfully',
            report: result.rows[0]
        };
    }

    /**
     * Get MOI report for a claim
     */
    async getMOIReport(claimId: string): Promise<any> {
        const result = await this.readPool.query(`
            SELECT * FROM moi_accident_reports
            WHERE claim_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `, [claimId]);

        if (result.rows.length === 0) {
            throw new MOIReportNotFoundError(claimId);
        }

        return result.rows[0];
    }

    /**
     * Verify/reject MOI report (insurance adjuster)
     */
    async verifyMOIReport(reportId: string, verified: boolean, notes?: string): Promise<any> {
        const result = await this.writePool.query(`
            UPDATE moi_accident_reports
            SET verified = $1, verification_notes = $2, verified_at = NOW()
            WHERE report_id = $3
            RETURNING *
        `, [verified, notes, reportId]);

        if (result.rowCount === 0) {
            throw new Error('MOI report not found');
        }

        return {
            message: verified ? 'MOI report verified' : 'MOI report rejected',
            report: result.rows[0]
        };
    }
}
