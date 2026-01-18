/**
 * Insurance Company Service
 * Handles insurance company directory
 */
import { Pool } from 'pg';

export class InsuranceCompanyService {
    constructor(private readPool: Pool) { }

    /**
     * Get list of insurance companies (for garage dropdown)
     */
    async getInsuranceCompanies(): Promise<any[]> {
        const result = await this.readPool.query(`
            SELECT company_id, name, company_code
            FROM insurance_companies
            WHERE is_active = true
            ORDER BY name
        `);

        return result.rows;
    }
}
