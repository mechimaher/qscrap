/**
 * Insurance Service Types
 */

export interface CreateClaimParams {
    agentId: string;
    companyId?: string | null;
    claimReferenceNumber?: string;
    policyNumber?: string;
    vinNumber?: string;
    customerName?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleYear?: number;
    partName?: string;
    notes?: string;
}

export interface MOIReportParams {
    claimId: string;
    reportNumber: string;
    accidentDate: Date;
    policeStation: string;
    vehicleVin: string;
    vehicleRegistration: string;
    driverName: string;
    driverIdNumber: string;
    reportDocumentUrl?: string;
    parsedData?: any;
    createdBy: string;
}

export interface SearchPartsParams {
    partName?: string;
    partType?: string;
    vehicleMake?: string;
    carMake?: string;
    carModel?: string;
    carYear?: string;
    vinNumber?: string;
    condition?: string;
}

export interface PriceCompareParams {
    partName?: string;
    partType?: string;
    vehicleMake?: string;
    carMake?: string;
    carModel?: string;
}

export interface GarageClaimSubmission {
    insuranceCompanyId: string;
    customerName: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear?: number;
    vinNumber?: string;
    damageDescription?: string;
    damagePhotos?: string[];
    partName: string;
    agencyEstimate?: number;
    scrapyardEstimate?: number;
    policeReportNumber?: string;
    garageId: string;
}
