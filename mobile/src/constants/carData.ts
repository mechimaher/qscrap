// Comprehensive Car Makes and Models for QScrap
// Sorted Alphabetically

export const CAR_MAKES = [
    'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Bentley', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler',
    'Citroën', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'GMC', 'Genesis', 'Honda', 'Hyundai',
    'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln',
    'Lucid', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan',
    'Peugeot', 'Porsche', 'Ram', 'Renault', 'Rivian', 'Rolls-Royce', 'Subaru', 'Suzuki',
    'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
];

export const CAR_MODELS: Record<string, string[]> = {
    'Acura': ['ILX', 'Integra', 'MDX', 'NSX', 'RDX', 'RLX', 'TLX'],
    'Alfa Romeo': ['4C', 'Giulia', 'Stelvio', 'Tonale'],
    'Audi': ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'e-tron', 'Q3', 'Q5', 'Q7', 'Q8', 'R8', 'RS e-tron GT', 'TT'],
    'BMW': ['1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '6 Series', '7 Series', '8 Series', 'i3', 'i4', 'iX', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4'],
    'Bentley': ['Bentayga', 'Continental GT', 'Flying Spur'],
    'Buick': ['Enclave', 'Encore', 'Encore GX', 'Envision'],
    'Cadillac': ['CT4', 'CT5', 'Escalade', 'Lyriq', 'XT4', 'XT5', 'XT6'],
    'Chevrolet': ['Blazer', 'Bolt EV', 'Camaro', 'Colorado', 'Corvette', 'Equinox', 'Express', 'Malibu', 'Silverado', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse', 'Trax'],
    'Chrysler': ['300', 'Pacifica', 'Voyager'],
    'Citroën': ['C3', 'C4', 'C5 Aircross'],
    'Dodge': ['Challenger', 'Charger', 'Durango', 'Hornet'],
    'Ferrari': ['296 GTB', '812 Superfast', 'F8 Tributo', 'Portofino M', 'Roma', 'SF90 Stradale'],
    'Fiat': ['500X'],
    'Ford': ['Bronco', 'Bronco Sport', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-Series Super Duty', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Ranger', 'Transit'],
    'GMC': ['Acadia', 'Canyon', 'Hummer EV', 'Sierra', 'Terrain', 'Yukon'],
    'Genesis': ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
    'Honda': ['Accord', 'Civic', 'CR-V', 'HR-V', 'Odyssey', 'Passport', 'Pilot', 'Ridgeline'],
    'Hyundai': ['Elantra', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Nexo', 'Palisade', 'Santa Cruz', 'Santa Fe', 'Sonata', 'Tucson', 'Venue'],
    'Infiniti': ['Q50', 'Q60', 'QX50', 'QX55', 'QX60', 'QX80'],
    'Jaguar': ['E-PACE', 'F-PACE', 'F-TYPE', 'I-PACE', 'XF'],
    'Jeep': ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wagoneer', 'Wrangler'],
    'Kia': ['Carnival', 'EV6', 'Forte', 'K5', 'Niro', 'Rio', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Telluride'],
    'Lamborghini': ['Aventador', 'Huracán', 'Urus'],
    'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
    'Lexus': ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'UX'],
    'Lincoln': ['Aviator', 'Corsair', 'Nautilus', 'Navigator'],
    'Lucid': ['Air'],
    'Maserati': ['Ghibli', 'Grecale', 'Levante', 'MC20', 'Quattroporte'],
    'Mazda': ['CX-30', 'CX-5', 'CX-50', 'CX-9', 'CX-90', 'Mazda3', 'MX-5 Miata'],
    'McLaren': ['720S', '765LT', 'Artura', 'GT'],
    'Mercedes-Benz': ['A-Class', 'C-Class', 'CLA', 'CLS', 'E-Class', 'EQB', 'EQE', 'EQS', 'G-Class', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'S-Class', 'SL'],
    'Mini': ['Clubman', 'Convertible', 'Cooper', 'Countryman'],
    'Mitsubishi': ['Eclipse Cross', 'Mirage', 'Outlander', 'Outlander Sport'],
    'Nissan': ['Altima', 'Ariya', 'Armada', 'Frontier', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Titan', 'Versa', 'Z'],
    'Peugeot': ['2008', '208', '3008', '308', '408', '5008', '508'],
    'Porsche': ['718 Boxster', '718 Cayman', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'],
    'Ram': ['1500', '2500', '3500'],
    'Renault': ['Arkana', 'Captur', 'Clio', 'Megane', 'Zoe'],
    'Rivian': ['R1S', 'R1T'],
    'Rolls-Royce': ['Cullinan', 'Ghost', 'Phantom', 'Spectre'],
    'Subaru': ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'WRX'],
    'Suzuki': ['Jimny', 'Swift', 'Vitara'],
    'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'],
    'Toyota': ['4Runner', 'Avalon', 'bZ4X', 'Camry', 'Corolla', 'Corolla Cross', 'Crown', 'GR86', 'Highlander', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Supra', 'Tacoma', 'Tundra', 'Venza'],
    'Volkswagen': ['Atlas', 'Atlas Cross Sport', 'Golf GTI', 'Golf R', 'ID.4', 'Jetta', 'Taos', 'Tiguan'],
    'Volvo': ['C40 Recharge', 'S60', 'S90', 'V60 Cross Country', 'V90 Cross Country', 'XC40', 'XC60', 'XC90']
};

export const YEARS = Array.from({ length: 37 }, (_, i) => (2026 - i).toString()); // 2026 down to 1990
