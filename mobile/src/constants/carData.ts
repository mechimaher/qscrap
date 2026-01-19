// Comprehensive Car Makes and Models Data for Qatar Market
// Covers all major brands with their popular models

export interface CarMake {
    make: string;
    models: string[];
}

export const CAR_DATA: CarMake[] = [
    // Japanese Brands (Most Popular in Qatar/GCC)
    {
        make: 'Toyota',
        models: ['Camry', 'Corolla', 'Land Cruiser', 'Prado', 'RAV4', 'Hilux', 'Yaris', 'Avalon', 'Fortuner', 'Supra', 'Crown', '86', 'Sequoia', 'Tundra', 'Tacoma', 'Highlander', 'C-HR', 'Rush', 'Granvia', 'Venza']
    },
    {
        make: 'Lexus',
        models: ['ES', 'IS', 'GS', 'LS', 'RX', 'NX', 'GX', 'LX', 'UX', 'LC', 'RC', 'RZ', 'TX']
    },
    {
        make: 'Nissan',
        models: ['Patrol', 'Altima', 'Maxima', 'Sunny', 'Sentra', 'X-Trail', 'Pathfinder', 'Armada', 'Kicks', 'Juke', 'Versa', 'Murano', 'Rogue', 'Frontier', 'Titan', '370Z', 'GT-R', 'Navara']
    },
    {
        make: 'Infiniti',
        models: ['Q50', 'Q60', 'Q70', 'QX50', 'QX55', 'QX60', 'QX70', 'QX80']
    },
    {
        make: 'Honda',
        models: ['Accord', 'Civic', 'HR-V', 'CR-V', 'Pilot', 'Odyssey', 'City', 'Jazz', 'BR-V', 'Passport', 'Ridgeline']
    },
    {
        make: 'Mazda',
        models: ['3', '6', 'CX-3', 'CX-30', 'CX-5', 'CX-8', 'CX-9', 'CX-50', 'CX-60', 'CX-90', 'MX-5', 'MX-30']
    },
    {
        make: 'Mitsubishi',
        models: ['Pajero', 'Montero', 'ASX', 'Outlander', 'Eclipse Cross', 'L200', 'Attrage', 'Mirage', 'Xpander', 'Triton']
    },
    {
        make: 'Suzuki',
        models: ['Swift', 'Vitara', 'Jimny', 'Dzire', 'Baleno', 'Grand Vitara', 'S-Cross', 'Ciaz', 'Ertiga']
    },
    {
        make: 'Subaru',
        models: ['Impreza', 'WRX', 'Legacy', 'Outback', 'Forester', 'XV', 'Crosstrek', 'Ascent', 'BRZ']
    },

    // German Brands (Luxury/Premium)
    {
        make: 'Mercedes-Benz',
        models: ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class', 'AMG GT', 'EQS', 'EQE', 'Maybach', 'CLA', 'CLS', 'SL']
    },
    {
        make: 'BMW',
        models: ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'XM', 'Z4', 'M2', 'M3', 'M4', 'M5', 'M8', 'iX', 'i4', 'i7']
    },
    {
        make: 'Audi',
        models: ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'RS3', 'RS5', 'RS6', 'RS7', 'R8', 'TT']
    },
    {
        make: 'Porsche',
        models: ['911', 'Cayenne', 'Macan', 'Panamera', 'Taycan', 'Boxster', 'Cayman', '718']
    },
    {
        make: 'Volkswagen',
        models: ['Golf', 'Passat', 'Jetta', 'Tiguan', 'Touareg', 'Arteon', 'ID.4', 'Polo', 'T-Roc', 'T-Cross', 'Atlas', 'Teramont']
    },

    // American Brands
    {
        make: 'Ford',
        models: ['Mustang', 'F-150', 'Expedition', 'Explorer', 'Edge', 'Escape', 'Bronco', 'Ranger', 'Taurus', 'Fusion', 'Focus', 'EcoSport', 'Everest', 'Raptor']
    },
    {
        make: 'Chevrolet',
        models: ['Camaro', 'Corvette', 'Tahoe', 'Suburban', 'Silverado', 'Traverse', 'Blazer', 'Equinox', 'Trailblazer', 'Malibu', 'Impala', 'Colorado', 'Captiva']
    },
    {
        make: 'GMC',
        models: ['Sierra', 'Yukon', 'Yukon XL', 'Denali', 'Terrain', 'Acadia', 'Canyon', 'Hummer EV']
    },
    {
        make: 'Cadillac',
        models: ['CT4', 'CT5', 'Escalade', 'XT4', 'XT5', 'XT6', 'Lyriq']
    },
    {
        make: 'Jeep',
        models: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator', 'Wagoneer', 'Grand Wagoneer']
    },
    {
        make: 'Dodge',
        models: ['Charger', 'Challenger', 'Durango', 'Ram 1500', 'Ram 2500', 'Hornet']
    },
    {
        make: 'Lincoln',
        models: ['Navigator', 'Aviator', 'Nautilus', 'Corsair']
    },
    {
        make: 'Tesla',
        models: ['Model S', 'Model 3', 'Model X', 'Model Y', 'Cybertruck']
    },

    // Korean Brands
    {
        make: 'Hyundai',
        models: ['Sonata', 'Elantra', 'Accent', 'Tucson', 'Santa Fe', 'Palisade', 'Kona', 'Venue', 'Creta', 'Grand Creta', 'Staria', 'Ioniq 5', 'Ioniq 6', 'Genesis (coupe)']
    },
    {
        make: 'Kia',
        models: ['Optima', 'Cerato', 'Rio', 'Sportage', 'Sorento', 'Telluride', 'Carnival', 'Seltos', 'Soul', 'Stinger', 'EV6', 'EV9', 'K5', 'K8']
    },
    {
        make: 'Genesis',
        models: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80']
    },

    // British Brands
    {
        make: 'Land Rover',
        models: ['Range Rover', 'Range Rover Sport', 'Range Rover Velar', 'Range Rover Evoque', 'Defender', 'Discovery', 'Discovery Sport']
    },
    {
        make: 'Jaguar',
        models: ['XE', 'XF', 'XJ', 'F-Type', 'F-Pace', 'E-Pace', 'I-Pace']
    },
    {
        make: 'Bentley',
        models: ['Continental GT', 'Flying Spur', 'Bentayga', 'Mulsanne']
    },
    {
        make: 'Rolls-Royce',
        models: ['Phantom', 'Ghost', 'Wraith', 'Dawn', 'Cullinan', 'Spectre']
    },
    {
        make: 'Aston Martin',
        models: ['DB11', 'DB12', 'DBS', 'Vantage', 'DBX', 'Valkyrie']
    },
    {
        make: 'McLaren',
        models: ['570S', '600LT', '720S', '765LT', 'Artura', 'GT']
    },
    {
        make: 'MINI',
        models: ['Cooper', 'Cooper S', 'Countryman', 'Clubman', 'Electric']
    },

    // Italian Brands
    {
        make: 'Ferrari',
        models: ['Roma', 'Portofino', 'F8', 'SF90', '296', '812', 'Purosangue']
    },
    {
        make: 'Lamborghini',
        models: ['Huracán', 'Urus', 'Revuelto']
    },
    {
        make: 'Maserati',
        models: ['Ghibli', 'Quattroporte', 'Levante', 'MC20', 'Grecale', 'GranTurismo']
    },
    {
        make: 'Alfa Romeo',
        models: ['Giulia', 'Stelvio', 'Tonale']
    },

    // Chinese Brands (Growing in Qatar)
    {
        make: 'MG',
        models: ['ZS', 'HS', 'RX5', 'RX8', 'ZS EV', 'Marvel R', 'MG5']
    },
    {
        make: 'Chery',
        models: ['Tiggo 7', 'Tiggo 8', 'Arrizo 6', 'Tiggo 4']
    },
    {
        make: 'Haval',
        models: ['H6', 'H9', 'Jolion', 'Dargo']
    },
    {
        make: 'Geely',
        models: ['Coolray', 'Monjaro', 'Azkarra', 'Okavango']
    },
    {
        make: 'BYD',
        models: ['Seal', 'Dolphin', 'Atto 3', 'Han', 'Tang']
    },
    {
        make: 'GAC',
        models: ['GS3', 'GS4', 'GS5', 'GS8', 'Empow']
    },

    // Other Popular Brands
    {
        make: 'Peugeot',
        models: ['208', '308', '408', '508', '2008', '3008', '5008']
    },
    {
        make: 'Renault',
        models: ['Duster', 'Koleos', 'Captur', 'Megane', 'Talisman', 'Symbol']
    },
    {
        make: 'Volvo',
        models: ['S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90', 'C40']
    },
    {
        make: 'Skoda',
        models: ['Octavia', 'Superb', 'Kodiaq', 'Karoq', 'Kamiq', 'Fabia']
    },

    // Trucks & Commercial
    {
        make: 'Isuzu',
        models: ['D-Max', 'MU-X', 'N-Series', 'F-Series']
    },
    {
        make: 'Hino',
        models: ['300', '500', '700']
    },

    // Fallback
    {
        make: 'Other',
        models: ['Other Model']
    }
];

// Helper functions
export const getAllMakes = (): string[] => {
    return CAR_DATA.map(item => item.make);
};

export const getModelsForMake = (make: string): string[] => {
    const found = CAR_DATA.find(item => item.make.toLowerCase() === make.toLowerCase());
    return found ? found.models : [];
};

// Generate year range (1980 to current year + 1)
export const generateYearRange = (startYear: number = 1980): number[] => {
    const currentYear = new Date().getFullYear();
    const endYear = currentYear + 1; // Include next year for new models
    const years: number[] = [];
    for (let year = endYear; year >= startYear; year--) {
        years.push(year);
    }
    return years;
};

export const YEARS = generateYearRange(1980);
