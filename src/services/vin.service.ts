/**
 * VIN Decoding Service
 * Implements simplified WMI (World Manufacturer Identifier) decoding for common cars in Qatar.
 */

interface VehicleDetails {
    make: string;
    model?: string;
    year?: number;
    country?: string;
    region?: string;
}

export class VINService {

    // Common WMI Mapping (Qatar Market Focus)
    private static wmiMap: Record<string, string> = {
        'JT': 'Toyota', 'JN': 'Nissan', 'JM': 'Mazda', 'JH': 'Honda',
        'JF': 'Subaru', 'JS': 'Suzuki', 'JA': 'Isuzu', 'JD': 'Daihatsu',
        'J8': 'Lexus',

        'WBA': 'BMW', 'WBS': 'BMW M', 'WDB': 'Mercedes-Benz', 'WDD': 'Mercedes-Benz',
        'WAU': 'Audi', 'WVW': 'Volkswagen', 'WP0': 'Porsche',

        '1F': 'Ford', '1J': 'Jeep', '1C': 'Chrysler', '1G': 'General Motors',
        '1L': 'Lincoln', '1M': 'Mercury', '1N': 'Nissan USA', '1T': 'Toyota USA',

        '2T': 'Toyota Canada', '3N': 'Nissan Mexico', '3V': 'Volkswagen Mexico',

        'KNA': 'Kia', 'KM': 'Hyundai',

        'L': 'China (Generic)',
        'M': 'India (Generic)', 'MA': 'Tata', 'MR': 'Mahindra'
    };

    /**
     * Decode VIN to get vehicle details.
     */
    decodeVIN(vin: string): VehicleDetails | null {
        if (!vin || vin.length !== 17) {return null;}

        const normalizedVin = vin.toUpperCase();
        const wmi = normalizedVin.substring(0, 2); // First 2 chars usually enough for major make group
        const wmi3 = normalizedVin.substring(0, 3); // First 3 for specificity

        let make = VINService.wmiMap[wmi3] || VINService.wmiMap[wmi];
        if (!make) {
            // Geographic Fallback
            if (normalizedVin.startsWith('J')) {make = 'Japanese Make';}
            else if (normalizedVin.startsWith('K')) {make = 'Korean Make';}
            else if (normalizedVin.startsWith('W')) {make = 'German Make';}
            else if (normalizedVin.startsWith('1') || normalizedVin.startsWith('4') || normalizedVin.startsWith('5')) {make = 'American Make';}
            else {return null;}
        }

        // Year decoding (10th character)
        const yearChar = normalizedVin[9];
        const year = this.decodeYear(yearChar);

        return {
            make,
            year,
            country: this.getRegion(normalizedVin[0])
        };
    }

    private decodeYear(char: string): number | undefined {
        const yearMap: Record<string, number> = {
            'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014, 'F': 2015, 'G': 2016, 'H': 2017,
            'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025, 'T': 2026,
            '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009
        };
        return yearMap[char];
    }

    private getRegion(char: string): string {
        if (/[A-H]/.test(char)) {return 'Africa';}
        if (/[J-R]/.test(char)) {return 'Asia';}
        if (/[S-Z]/.test(char)) {return 'Europe';}
        if (/[1-5]/.test(char)) {return 'North America';}
        if (/[6-7]/.test(char)) {return 'Oceania';}
        if (/[8-9]/.test(char)) {return 'South America';}
        return 'Unknown';
    }
}

export const vinService = new VINService();
