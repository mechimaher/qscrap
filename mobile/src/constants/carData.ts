// Comprehensive Car Makes and Models for QScrap
// Updated with GCC/Middle East market focus and complete global production models
// Covers 1990-2026 model years

export const CAR_MAKES = [
    // Japanese - Very Popular in GCC
    'Toyota', 'Lexus', 'Nissan', 'Infiniti', 'Honda', 'Acura', 'Mazda', 'Mitsubishi', 'Subaru', 'Suzuki', 'Isuzu', 'Daihatsu',
    // Korean
    'Hyundai', 'Kia', 'Genesis', 'SsangYong',
    // American
    'Ford', 'Chevrolet', 'GMC', 'Cadillac', 'Buick', 'Dodge', 'Chrysler', 'Jeep', 'Ram', 'Lincoln', 'Tesla', 'Rivian', 'Lucid',
    // German
    'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen', 'Porsche', 'Mini',
    // British
    'Land Rover', 'Jaguar', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren',
    // Italian
    'Ferrari', 'Lamborghini', 'Maserati', 'Alfa Romeo', 'Fiat',
    // French
    'Peugeot', 'Renault', 'Citroën',
    // Swedish
    'Volvo',
    // Chinese - Growing in GCC
    'BYD', 'Chery', 'Geely', 'Haval', 'Great Wall', 'MG', 'Changan', 'GAC', 'JAC', 'Dongfeng', 'Hongqi', 'Tank', 'Jetour', 'Exeed',
    // Other
    'BAIC', 'GWM', 'Polestar'
];

export const CAR_MODELS: Record<string, string[]> = {
    // ============== JAPANESE ==============
    'Toyota': [
        // SUVs - GCC Favorites
        'Land Cruiser', 'Land Cruiser 300', 'Land Cruiser 200', 'Land Cruiser 100', 'Land Cruiser 80', 'Land Cruiser 70', 'Land Cruiser Pickup',
        'Prado', 'Prado 150', 'Prado 120', 'Prado 90', 'FJ Cruiser',
        'Fortuner', 'Highlander', 'Grand Highlander', 'Sequoia', '4Runner', 'RAV4', 'C-HR', 'Venza', 'Corolla Cross', 'Yaris Cross',
        // Sedans
        'Camry', 'Corolla', 'Avalon', 'Crown', 'Crown Signia', 'Yaris',
        // Trucks
        'Hilux', 'Tacoma', 'Tundra',
        // Vans & MPVs
        'Sienna', 'Innova', 'Avanza', 'Veloz', 'Alphard', 'Vellfire', 'Granvia', 'HiAce',
        // Sports & Performance
        'Supra', 'GR86', 'GR Corolla', 'GR Yaris', 'MR2', 'Celica', '2000GT',
        // Electric/Hybrid
        'Prius', 'bZ4X', 'bZ3',
        // Commercial
        'Coaster', 'ToyoAce', 'Dyna',
        // Historic
        'Corona', 'Cressida', 'Tercel', 'Paseo', 'Echo', 'Previa', 'T100'
    ],
    'Lexus': [
        // SUVs
        'LX', 'LX570', 'LX600', 'GX', 'GX460', 'GX550', 'RX', 'RX350', 'RX450h', 'RX500h', 'NX', 'NX350h', 'UX', 'UX250h',
        // Sedans
        'LS', 'LS500', 'ES', 'ES350', 'ES300h', 'IS', 'IS350', 'IS500', 'GS', 'GS350', 'GS450h',
        // Coupes & Sports
        'LC', 'LC500', 'RC', 'RC350', 'RC F', 'LFA',
        // Electric
        'RZ', 'RZ350e', 'RZ450e'
    ],
    'Nissan': [
        // SUVs - GCC Favorites
        'Patrol', 'Patrol Y62', 'Patrol Safari', 'Patrol Super Safari', 'Armada',
        'X-Trail', 'Pathfinder', 'Murano', 'Qashqai', 'Rogue', 'Kicks', 'Juke', 'Terra', 'Xterra', 'Terrano',
        // Sedans
        'Altima', 'Maxima', 'Sentra', 'Sunny', 'Almera', 'Versa', 'Tiida',
        // Trucks
        'Navara', 'Frontier', 'Titan', 'NP300',
        // Sports
        'GT-R', 'Z', '370Z', '350Z', '300ZX', 'Fairlady Z', 'Silvia',
        // Electric
        'Leaf', 'Ariya',
        // Commercial
        'Urvan', 'NV350', 'Patrol Pickup'
    ],
    'Infiniti': [
        'QX80', 'QX60', 'QX55', 'QX50', 'Q50', 'Q60', 'Q70',
        'FX35', 'FX45', 'FX50', 'EX35', 'JX35', 'M35', 'M45', 'G35', 'G37'
    ],
    'Honda': [
        // SUVs
        'Pilot', 'Passport', 'CR-V', 'HR-V', 'ZR-V', 'Prologue',
        // Sedans
        'Accord', 'Civic', 'City', 'Insight',
        // MPVs
        'Odyssey',
        // Trucks
        'Ridgeline',
        // Sports
        'Prelude', 'Integra', 'S2000', 'NSX', 'CR-X'
    ],
    'Acura': [
        'MDX', 'RDX', 'ZDX', 'TLX', 'Integra', 'NSX', 'ILX', 'RLX', 'TSX', 'TL', 'Legend'
    ],
    'Mazda': [
        // SUVs
        'CX-90', 'CX-70', 'CX-60', 'CX-50', 'CX-9', 'CX-5', 'CX-30', 'CX-3', 'MX-30',
        // Sedans
        'Mazda6', 'Mazda3', 'Mazda2',
        // Sports
        'MX-5 Miata', 'RX-7', 'RX-8',
        // Historic
        '323', '626', 'MPV', 'Tribute', 'B-Series'
    ],
    'Mitsubishi': [
        // SUVs - GCC Popular
        'Pajero', 'Pajero Sport', 'Montero', 'Montero Sport', 'Outlander', 'Eclipse Cross', 'ASX',
        // Trucks
        'L200', 'Triton', 'Strada',
        // Sedans
        'Lancer', 'Lancer Evolution', 'Galant', 'Mirage', 'Attrage',
        // MPVs
        'Xpander', 'Delica',
        // Historic
        '3000GT', 'Eclipse'
    ],
    'Subaru': [
        'Outback', 'Forester', 'Crosstrek', 'Ascent', 'Solterra',
        'Legacy', 'Impreza', 'WRX', 'BRZ', 'XV', 'Baja', 'Tribeca'
    ],
    'Suzuki': [
        'Jimny', 'Grand Vitara', 'Vitara', 'Swift', 'Swift Sport', 'Dzire', 'Ciaz', 'Ertiga', 'XL7', 'S-Cross',
        'Alto', 'Celerio', 'Baleno', 'SX4', 'Ignis', 'Wagon R'
    ],
    'Isuzu': [
        'D-Max', 'MU-X', 'Trooper', 'Rodeo', 'Ascender', 'NPR', 'NQR', 'FRR'
    ],
    'Daihatsu': [
        'Terios', 'Rocky', 'Sirion', 'Mira', 'Move', 'Boon', 'Charade', 'YRV'
    ],

    // ============== KOREAN ==============
    'Hyundai': [
        // SUVs
        'Palisade', 'Santa Fe', 'Tucson', 'Kona', 'Venue', 'Creta', 'Nexo',
        // Sedans
        'Sonata', 'Elantra', 'Accent', 'Azera', 'Genesis (old)',
        // MPVs
        'Staria', 'H-1',
        // Electric
        'Ioniq 5', 'Ioniq 6', 'Ioniq 9',
        // Historic
        'Santa Cruz', 'Veloster', 'i10', 'i20', 'i30', 'i40', 'Veracruz', 'Terracan'
    ],
    'Kia': [
        // SUVs
        'Telluride', 'Sorento', 'Sportage', 'Seltos', 'Niro', 'Soul',
        // Sedans
        'K5', 'Cerato', 'Forte', 'Rio', 'K9', 'Cadenza', 'Optima',
        // MPVs
        'Carnival', 'Sedona',
        // Electric
        'EV6', 'EV9',
        // Sports
        'Stinger',
        // Trucks
        'Tasman',
        // Historic
        'Mohave', 'Borrego', 'Rondo'
    ],
    'Genesis': [
        'G90', 'G80', 'G70', 'GV80', 'GV70', 'GV60', 'Electrified G80', 'Electrified GV70'
    ],
    'SsangYong': [
        'Rexton', 'Korando', 'Tivoli', 'Torres', 'Musso', 'Actyon', 'Rodius', 'Kyron', 'Chairman'
    ],

    // ============== AMERICAN ==============
    'Ford': [
        // SUVs
        'Explorer', 'Expedition', 'Bronco', 'Bronco Sport', 'Escape', 'Edge', 'EcoSport',
        // Trucks
        'F-150', 'F-250', 'F-350', 'Ranger', 'Maverick',
        // Sedans
        'Fusion', 'Taurus', 'Focus',
        // Sports
        'Mustang', 'Mustang Mach-E', 'GT',
        // Vans
        'Transit', 'E-Transit',
        // Historic
        'Crown Victoria', 'Thunderbird', 'Excursion', 'Flex'
    ],
    'Chevrolet': [
        // SUVs
        'Tahoe', 'Suburban', 'Traverse', 'Blazer', 'Trailblazer', 'Equinox', 'Trax',
        // Trucks
        'Silverado', 'Colorado', 'Avalanche',
        // Sedans
        'Malibu', 'Impala', 'Cruze',
        // Sports
        'Corvette', 'Camaro',
        // Electric
        'Bolt EV', 'Bolt EUV', 'Equinox EV', 'Silverado EV',
        // Vans
        'Express',
        // Historic
        'Caprice', 'Monte Carlo', 'Lumina', 'Captiva', 'Spark'
    ],
    'GMC': [
        'Yukon', 'Yukon XL', 'Terrain', 'Acadia', 'Hummer EV', 'Sierra', 'Canyon', 'Savana', 'Envoy'
    ],
    'Cadillac': [
        'Escalade', 'Escalade ESV', 'XT6', 'XT5', 'XT4', 'Lyriq', 'CT5', 'CT4',
        'Celestiq', 'Vistiq', 'Optiq', 'CTS', 'ATS', 'XTS', 'SRX', 'DTS', 'Seville', 'DeVille'
    ],
    'Dodge': [
        'Durango', 'Challenger', 'Charger', 'Charger Daytona', 'Hornet', 'Journey', 'Nitro', 'Caliber', 'Dart', 'Neon', 'Viper'
    ],
    'Chrysler': [
        'Pacifica', '300', 'Voyager', 'PT Cruiser', 'Sebring', 'Town & Country', 'Crossfire'
    ],
    'Jeep': [
        'Grand Cherokee', 'Grand Cherokee L', 'Wrangler', 'Wrangler Unlimited', 'Gladiator', 'Grand Wagoneer', 'Wagoneer',
        'Cherokee', 'Compass', 'Renegade', 'Commander', 'Liberty', 'Patriot'
    ],
    'Ram': [
        '1500', '2500', '3500', 'ProMaster', 'ProMaster City'
    ],
    'Lincoln': [
        'Navigator', 'Aviator', 'Nautilus', 'Corsair', 'MKX', 'MKC', 'MKZ', 'Continental', 'Town Car'
    ],
    'Tesla': [
        'Model S', 'Model 3', 'Model X', 'Model Y', 'Cybertruck', 'Roadster', 'Semi'
    ],
    'Rivian': [
        'R1T', 'R1S', 'R2', 'R3'
    ],
    'Lucid': [
        'Air', 'Air Grand Touring', 'Air Sapphire', 'Gravity'
    ],

    // ============== GERMAN ==============
    'Mercedes-Benz': [
        // SUVs
        'GLS', 'GLE', 'GLC', 'GLB', 'GLA', 'G-Class', 'G-Wagon',
        // Sedans
        'S-Class', 'E-Class', 'C-Class', 'A-Class', 'CLA', 'CLS',
        // Coupes
        'SL', 'AMG GT', 'SLC',
        // Electric
        'EQS', 'EQS SUV', 'EQE', 'EQE SUV', 'EQB', 'EQA',
        // Vans
        'V-Class', 'Vito', 'Sprinter',
        // AMG
        'AMG GT', 'AMG GLE 63', 'AMG G63',
        // Historic
        'ML', 'GL', 'R-Class', 'CLK', 'SLK'
    ],
    'BMW': [
        // SUVs
        'X7', 'X6', 'X5', 'X4', 'X3', 'X2', 'X1', 'XM', 'iX',
        // Sedans
        '7 Series', '5 Series', '3 Series', '2 Series', '8 Series',
        // Electric
        'i7', 'i5', 'i4', 'iX3', 'iX1', 'i3',
        // Sports
        'Z4', 'M2', 'M3', 'M4', 'M5', 'M8',
        // Historic
        '6 Series', '1 Series', 'Z3'
    ],
    'Audi': [
        // SUVs
        'Q8', 'Q7', 'Q5', 'Q4 e-tron', 'Q3', 'Q2', 'e-tron', 'e-tron GT',
        // Sedans
        'A8', 'A7', 'A6', 'A5', 'A4', 'A3', 'A1',
        // Sports
        'TT', 'R8', 'RS6', 'RS7', 'RS e-tron GT',
        // Historic
        '80', '100', 'Allroad'
    ],
    'Volkswagen': [
        'Touareg', 'Atlas', 'Atlas Cross Sport', 'Tiguan', 'Taos', 'ID.4', 'ID.Buzz', 'ID.3',
        'Passat', 'Arteon', 'Jetta', 'Golf', 'Golf GTI', 'Golf R', 'Polo',
        'Beetle', 'Scirocco', 'Phaeton', 'CC', 'Sharan'
    ],
    'Porsche': [
        'Cayenne', 'Cayenne Coupe', 'Macan', 'Panamera', 'Taycan', 'Taycan Cross Turismo',
        '911', '911 Turbo', '911 GT3', '718 Cayman', '718 Boxster', 'Carrera GT', '918 Spyder'
    ],
    'Mini': [
        'Cooper', 'Cooper S', 'Clubman', 'Countryman', 'Convertible', 'Electric',
        'Paceman', 'Coupe', 'Roadster'
    ],

    // ============== BRITISH ==============
    'Land Rover': [
        'Range Rover', 'Range Rover Sport', 'Range Rover Velar', 'Range Rover Evoque',
        'Defender', 'Defender 90', 'Defender 110', 'Defender 130',
        'Discovery', 'Discovery Sport',
        'Freelander', 'LR2', 'LR4'
    ],
    'Jaguar': [
        'F-PACE', 'E-PACE', 'I-PACE', 'F-TYPE', 'XF', 'XE', 'XJ', 'XK', 'S-Type', 'X-Type'
    ],
    'Bentley': [
        'Bentayga', 'Continental GT', 'Flying Spur', 'Mulsanne', 'Arnage', 'Azure'
    ],
    'Rolls-Royce': [
        'Phantom', 'Ghost', 'Cullinan', 'Wraith', 'Dawn', 'Spectre'
    ],
    'Aston Martin': [
        'DBX', 'DBS Superleggera', 'DB11', 'Vantage', 'DB12', 'Valkyrie', 'Vanquish', 'Rapide'
    ],
    'McLaren': [
        '720S', '765LT', 'Artura', 'GT', '570S', '600LT', 'P1', 'Senna', 'Speedtail'
    ],

    // ============== ITALIAN ==============
    'Ferrari': [
        '296 GTB', '296 GTS', 'SF90 Stradale', 'SF90 Spider', 'Roma', 'Portofino M', 'F8 Tributo', 'F8 Spider',
        '812 Superfast', '812 GTS', 'Purosangue', 'F12', '488', '458', 'California', 'LaFerrari'
    ],
    'Lamborghini': [
        'Urus', 'Revuelto', 'Huracan', 'Huracan STO', 'Huracan Sterrato', 'Aventador', 'Aventador SVJ', 'Gallardo', 'Murcielago'
    ],
    'Maserati': [
        'Grecale', 'Levante', 'GranTurismo', 'MC20', 'Ghibli', 'Quattroporte', 'GranCabrio'
    ],
    'Alfa Romeo': [
        'Tonale', 'Stelvio', 'Giulia', '4C', 'Giulietta', 'MiTo', '159', '156'
    ],
    'Fiat': [
        '500X', '500', '500e', 'Panda', 'Tipo', 'Punto', 'Ducato', 'Doblo'
    ],

    // ============== FRENCH ==============
    'Peugeot': [
        '5008', '3008', '2008', '508', '408', '308', '208', 'Partner', 'Landtrek', 'Rifter', 'Traveller'
    ],
    'Renault': [
        'Koleos', 'Arkana', 'Captur', 'Kadjar', 'Megane', 'Talisman', 'Clio', 'Zoe', 'Duster', 'Scenic', 'Espace'
    ],
    'Citroën': [
        'C5 Aircross', 'C4', 'C3 Aircross', 'C3', 'Berlingo', 'SpaceTourer', 'C5 X', 'C-Elysée'
    ],

    // ============== SWEDISH ==============
    'Volvo': [
        'XC90', 'XC60', 'XC40', 'EX90', 'EX40', 'EC40', 'C40 Recharge',
        'S90', 'S60', 'V90', 'V60', 'V40',
        'V90 Cross Country', 'V60 Cross Country'
    ],

    // ============== CHINESE ==============
    'BYD': [
        'Seal', 'Atto 3', 'Han', 'Tang', 'Song Plus', 'Song Pro', 'Yuan Plus', 'Dolphin', 'Qin Plus', 'Seagull', 'Destroyer 05', 'U8', 'YangWang U8'
    ],
    'Chery': [
        'Tiggo 8 Pro Max', 'Tiggo 8 Pro', 'Tiggo 8', 'Tiggo 7 Pro', 'Tiggo 7', 'Tiggo 4 Pro', 'Tiggo 4', 'Tiggo 3',
        'Arrizo 6', 'Arrizo 5', 'Omoda 5', 'Omoda 7', 'Jaecoo 7'
    ],
    'Geely': [
        'Coolray', 'Azkarra', 'Monjaro', 'Okavango', 'Emgrand', 'GC9', 'Starray', 'Preface',
        'Tugella', 'Atlas', 'Boyue'
    ],
    'Haval': [
        'H6', 'H9', 'Jolion', 'Dargo', 'F7', 'F5', 'H2', 'H4', 'M6', 'H6S', 'H6 GT'
    ],
    'Great Wall': [
        'Poer', 'Wingle', 'Safe', 'Steed', 'Cannon'
    ],
    'MG': [
        'HS', 'ZS', 'ZS EV', 'RX5', 'GT', 'MG5', 'MG6', 'MG7', 'Marvel R', 'Cyberster', 'One', 'Whale', 'MG4'
    ],
    'Changan': [
        'CS75 Plus', 'CS75', 'CS55 Plus', 'CS55', 'CS35 Plus', 'CS35', 'UNI-T', 'UNI-K', 'UNI-V', 'Eado'
    ],
    'GAC': [
        'GS8', 'GS4', 'GS3', 'GM8', 'Empow', 'Aion S', 'Aion Y', 'Aion V', 'Aion LX', 'Trumpchi', 'Emkoo'
    ],
    'JAC': [
        'JS2', 'JS3', 'JS4', 'JS6', 'JS7', 'T6', 'T8', 'Refine', 'iEV'
    ],
    'Dongfeng': [
        'AX7', 'AX5', 'AX3', 'SX5', 'SX6', 'Forthing', 'Voyah'
    ],
    'Hongqi': [
        'H5', 'H7', 'H9', 'HS5', 'E-HS9', 'E-HS3', 'L5'
    ],
    'Tank': [
        'Tank 300', 'Tank 500', 'Tank 700', 'Tank 800'
    ],
    'Jetour': [
        'X70', 'X90', 'Dashing', 'T2', 'X50', 'Traveller'
    ],
    'Exeed': [
        'TXL', 'VX', 'LX', 'RX', 'Yaoguang'
    ],
    'GWM': [
        'Tank 300', 'Tank 500', 'Ora', 'Haval', 'Wey'
    ],
    'BAIC': [
        'BJ40', 'BJ60', 'BJ30', 'X55', 'X35', 'X7', 'EU5', 'EX5'
    ],
    'Polestar': [
        'Polestar 1', 'Polestar 2', 'Polestar 3', 'Polestar 4', 'Polestar 5'
    ]
};

// Year range 1990 to 2026
export const YEARS = Array.from({ length: 37 }, (_, i) => (2026 - i).toString());

// Model year starts
export const MODEL_YEAR_START = 1990;
export const MODEL_YEAR_END = 2026;
