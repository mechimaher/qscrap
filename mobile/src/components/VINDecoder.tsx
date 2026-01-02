import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, FontSizes, Shadows } from '../constants/theme';

interface VINDecoderProps {
    value: string;
    onChangeText: (text: string) => void;
    onDecoded?: (data: DecodedVIN) => void;
}

export interface DecodedVIN {
    make: string;
    model: string;
    year: string;
    bodyType?: string;
    engineSize?: string;
    fuelType?: string;
    driveType?: string;
    transmission?: string;
    country?: string;
}

// VIN Position meanings
// Pos 1: Country
// Pos 2: Manufacturer  
// Pos 3: Vehicle Type
// Pos 4-8: Vehicle attributes
// Pos 9: Check digit
// Pos 10: Model year
// Pos 11: Plant
// Pos 12-17: Serial number

// Year codes (VIN position 10)
const YEAR_CODES: Record<string, string> = {
    'A': '2010', 'B': '2011', 'C': '2012', 'D': '2013', 'E': '2014',
    'F': '2015', 'G': '2016', 'H': '2017', 'J': '2018', 'K': '2019',
    'L': '2020', 'M': '2021', 'N': '2022', 'P': '2023', 'R': '2024',
    'S': '2025', 'T': '2026', 'V': '2027', 'W': '2028', 'X': '2029',
    'Y': '2030', '1': '2031', '2': '2032', '3': '2033', '4': '2034',
    '5': '2035', '6': '2036', '7': '2037', '8': '2038', '9': '2039',
};

// Common manufacturer codes (WMI - first 3 chars)
const MANUFACTURER_CODES: Record<string, { make: string; country: string }> = {
    // Japanese - Comprehensive
    'JTD': { make: 'Toyota', country: 'Japan' },
    'JTE': { make: 'Toyota', country: 'Japan' },
    'JTM': { make: 'Toyota', country: 'Japan' },
    'JTN': { make: 'Toyota', country: 'Japan' },
    'JTK': { make: 'Toyota', country: 'Japan' },
    'JTH': { make: 'Lexus', country: 'Japan' },
    'JTJ': { make: 'Lexus', country: 'Japan' },
    'JHM': { make: 'Honda', country: 'Japan' },
    'JHL': { make: 'Honda', country: 'Japan' },
    'SHH': { make: 'Honda', country: 'UK' },
    'JN1': { make: 'Nissan', country: 'Japan' },
    'JN8': { make: 'Nissan', country: 'Japan' },
    'JNK': { make: 'Infiniti', country: 'Japan' },
    '5N1': { make: 'Nissan', country: 'USA' },
    'JM1': { make: 'Mazda', country: 'Japan' },
    'JM3': { make: 'Mazda', country: 'Japan' },
    'JF1': { make: 'Subaru', country: 'Japan' },
    'JF2': { make: 'Subaru', country: 'Japan' },
    '4S3': { make: 'Subaru', country: 'USA' },
    'JS1': { make: 'Suzuki', country: 'Japan' },
    'JS2': { make: 'Suzuki', country: 'Japan' },
    'TSM': { make: 'Suzuki', country: 'Hungary' },
    'JA3': { make: 'Mitsubishi', country: 'Japan' },
    'JA4': { make: 'Mitsubishi', country: 'Japan' },
    'JMY': { make: 'Mitsubishi', country: 'Japan' },
    'JMB': { make: 'Mitsubishi', country: 'Japan' },
    'JDA': { make: 'Daihatsu', country: 'Japan' },
    'JDB': { make: 'Daihatsu', country: 'Japan' },
    'JAA': { make: 'Isuzu', country: 'Japan' },
    'JAL': { make: 'Isuzu', country: 'Japan' },

    // Korean - Comprehensive
    'KMH': { make: 'Hyundai', country: 'Korea' },
    'KMJ': { make: 'Hyundai', country: 'Korea' },
    'KMF': { make: 'Hyundai', country: 'Korea' },
    '5NP': { make: 'Hyundai', country: 'USA' },
    '5XY': { make: 'Hyundai', country: 'USA' },
    'KNA': { make: 'Kia', country: 'Korea' },
    'KNC': { make: 'Kia', country: 'Korea' },
    'KND': { make: 'Kia', country: 'Korea' },
    'KNE': { make: 'Kia', country: 'Korea' },
    'KNM': { make: 'Renault Samsung', country: 'Korea' },
    'KPT': { make: 'SsangYong', country: 'Korea' },
    'KPA': { make: 'SsangYong', country: 'Korea' },
    'KMT': { make: 'Genesis', country: 'Korea' },
    'KMN': { make: 'Genesis', country: 'Korea' },

    // Chinese - Popular in Qatar & Middle East
    'LVS': { make: 'Chery', country: 'China' },
    'LVV': { make: 'Chery', country: 'China' },
    'LJD': { make: 'Chery', country: 'China' },
    'L6T': { make: 'Geely', country: 'China' },
    'LE4': { make: 'Geely', country: 'China' },
    'LB1': { make: 'Geely', country: 'China' },
    'LFV': { make: 'BYD', country: 'China' },
    'LGX': { make: 'BYD', country: 'China' },
    'LC0': { make: 'BYD', country: 'China' },
    'LGW': { make: 'Haval', country: 'China' },
    'LZW': { make: 'Haval', country: 'China' },
    'LGJ': { make: 'Great Wall', country: 'China' },
    'LZG': { make: 'Great Wall', country: 'China' },
    'LSJ': { make: 'MG', country: 'China' },
    'LMS': { make: 'MG', country: 'China' },
    'LS5': { make: 'Changan', country: 'China' },
    'LS4': { make: 'Changan', country: 'China' },
    'LJ1': { make: 'JAC', country: 'China' },
    'LJ4': { make: 'JAC', country: 'China' },
    'LGH': { make: 'Dongfeng', country: 'China' },
    'LGC': { make: 'Dongfeng', country: 'China' },
    'LMG': { make: 'GAC', country: 'China' },
    'LGG': { make: 'GAC', country: 'China' },
    'LFB': { make: 'Hongqi', country: 'China' },
    'LFE': { make: 'FAW', country: 'China' },
    'LVG': { make: 'Jetour', country: 'China' },
    'LJC': { make: 'Foton', country: 'China' },
    'LKL': { make: 'Tank', country: 'China' },
    'LFM': { make: 'Exeed', country: 'China' },
    'LDC': { make: 'Peugeot-Dongfeng', country: 'China' },
    'LEN': { make: 'Citroen-Dongfeng', country: 'China' },

    // American
    '1FA': { make: 'Ford', country: 'USA' },
    '1FM': { make: 'Ford', country: 'USA' },
    '1FT': { make: 'Ford', country: 'USA' },
    '1G1': { make: 'Chevrolet', country: 'USA' },
    '1GC': { make: 'Chevrolet', country: 'USA' },
    '1GT': { make: 'GMC', country: 'USA' },
    '2G1': { make: 'Chevrolet', country: 'Canada' },
    '1C3': { make: 'Chrysler', country: 'USA' },
    '1C4': { make: 'Chrysler', country: 'USA' },
    '2C3': { make: 'Chrysler', country: 'Canada' },
    '3FA': { make: 'Ford', country: 'Mexico' },
    '5YJ': { make: 'Tesla', country: 'USA' },
    '7SA': { make: 'Tesla', country: 'USA' },

    // German
    'WAU': { make: 'Audi', country: 'Germany' },
    'WA1': { make: 'Audi', country: 'Germany' },
    'WBA': { make: 'BMW', country: 'Germany' },
    'WBS': { make: 'BMW M', country: 'Germany' },
    'WBY': { make: 'BMW i', country: 'Germany' },
    'WDB': { make: 'Mercedes-Benz', country: 'Germany' },
    'WDC': { make: 'Mercedes-Benz', country: 'Germany' },
    'WDD': { make: 'Mercedes-Benz', country: 'Germany' },
    'W1K': { make: 'Mercedes-AMG', country: 'Germany' },
    'WVW': { make: 'Volkswagen', country: 'Germany' },
    'WV1': { make: 'Volkswagen Commercial', country: 'Germany' },
    'WP0': { make: 'Porsche', country: 'Germany' },
    'WP1': { make: 'Porsche', country: 'Germany' },

    // European
    'SAJ': { make: 'Jaguar', country: 'UK' },
    'SAL': { make: 'Land Rover', country: 'UK' },
    'SAR': { make: 'Land Rover', country: 'UK' },
    'ZFA': { make: 'Fiat', country: 'Italy' },
    'ZFF': { make: 'Ferrari', country: 'Italy' },
    'ZAM': { make: 'Maserati', country: 'Italy' },
    'ZAR': { make: 'Alfa Romeo', country: 'Italy' },
    'ZHW': { make: 'Lamborghini', country: 'Italy' },
    'VF1': { make: 'Renault', country: 'France' },
    'VF7': { make: 'Citroen', country: 'France' },
    'VF3': { make: 'Peugeot', country: 'France' },
    'VNK': { make: 'Toyota', country: 'France' },
    'YS3': { make: 'Volvo', country: 'Sweden' },

    // UAE/Middle East production
    '6T1': { make: 'Toyota', country: 'Australia' },
    'MNT': { make: 'Nissan', country: 'UAE' },
    'MBJ': { make: 'Mitsubishi', country: 'Thailand' },
    'MHR': { make: 'Honda', country: 'Indonesia' },
    'MHF': { make: 'Toyota', country: 'Thailand' },
};

// Extended model database using VDS (positions 4-8) patterns
// Format: First 1-3 chars of VDS section mapped to model names
const MODEL_DATABASE: Record<string, Record<string, string>> = {
    'Toyota': {
        // VDS patterns (chars 4-8)
        'BU': 'Camry', 'BF': 'Camry', 'BK': 'Camry',
        'HP': 'RAV4', 'HK': 'RAV4', 'HW': 'RAV4',
        'R3': 'Corolla', 'R1': 'Corolla', 'RN': 'Corolla',
        'UF': 'Land Cruiser', 'UR': 'Land Cruiser', 'UZ': 'Land Cruiser 200',
        'GR': 'Land Cruiser 300', 'GN': 'Hilux', 'GW': 'Hilux', 'GD': 'Hilux',
        'KC': 'Prado', 'KD': 'Prado', 'KJ': 'Prado 150',
        'SW': 'Fortuner', 'SR': 'Fortuner',
        'KS': 'Yaris', 'KP': 'Yaris', 'NK': 'Yaris Cross',
        'MU': 'Avalon', 'MR': 'Highlander', 'MD': 'Highlander',
        '8R': '4Runner', '8N': 'Sequoia', 'TW': 'Tundra',
        'SK': 'Sienna', 'SC': 'Supra', 'DB': 'Tacoma',
        'ZN': 'C-HR', 'AC': 'Corolla Cross', 'A1': 'Aygo',
    },
    'Lexus': {
        'AG': 'ES', 'AK': 'ES350', 'AS': 'ES300h',
        'BC': 'GS', 'BD': 'GS350', 'BE': 'GS450h',
        'CE': 'IS', 'CC': 'IS350', 'CF': 'IS300',
        'DZ': 'LS', 'DA': 'LS500',
        'JA': 'RX', 'JC': 'RX350', 'JD': 'RX450h',
        'JK': 'NX', 'JN': 'NX300', 'JM': 'NX350h',
        'TB': 'GX', 'TC': 'GX460', 'TD': 'GX550',
        'TJ': 'LX', 'TK': 'LX570', 'TL': 'LX600',
        'ZA': 'UX', 'ZC': 'UX250h', 'FA': 'LC', 'FC': 'LC500',
    },
    'Nissan': {
        'L3': 'Altima', 'L33': 'Altima', 'L34': 'Altima',
        // Patrol - multiple VDS patterns used across generations
        'Y6': 'Patrol', 'Y62': 'Patrol', 'Y61': 'Patrol Safari',
        'BT': 'Patrol', 'BT2': 'Patrol', 'TB': 'Patrol', 'TBW': 'Patrol',
        'B1': 'Sentra', 'B17': 'Sentra', 'B18': 'Sentra',
        'R5': 'Pathfinder', 'R52': 'Pathfinder', 'R53': 'Pathfinder',
        'T3': 'X-Trail', 'T32': 'X-Trail', 'T33': 'X-Trail',
        'N1': 'Sunny', 'N17': 'Sunny', 'N18': 'Almera',
        'A3': 'Maxima', 'A35': 'Maxima', 'A36': 'Maxima',
        'Z5': 'Murano', 'Z52': 'Murano',
        'J1': 'Qashqai', 'J11': 'Qashqai', 'J12': 'Qashqai',
        'P3': 'Kicks', 'E1': 'Rogue', 'T60': 'Navara',
        'F1': 'Versa', 'D2': 'Juke', 'E2': 'Armada', 'Y5': 'Titan',
        'Z3': '370Z', 'RZ': '350Z', 'GT': 'GT-R',
    },
    'Honda': {
        'CV': 'Accord', 'CR': 'Accord', 'CW': 'Accord',
        'FC': 'Civic', 'FE': 'Civic', 'FB': 'Civic',
        'RW': 'CR-V', 'RT': 'CR-V', 'RM': 'CR-V',
        'YF': 'Pilot', 'YL': 'Pilot',
        'RU': 'HR-V', 'RS': 'HR-V', 'RV': 'HR-V',
        'RL': 'Odyssey', 'RC': 'Odyssey',
        'GM': 'City', 'GN': 'City', 'GR': 'City',
        'GK': 'Jazz', 'GE': 'Fit', 'GG': 'Jazz',
        'NC': 'Ridgeline', 'NF': 'Passport', 'BE': 'Prelude',
    },
    'Mercedes-Benz': {
        'WD': 'A-Class', 'WH': 'A-Class', '177': 'A-Class',
        'WF': 'B-Class', '246': 'B-Class',
        'WC': 'C-Class', 'WJ': 'C-Class', '205': 'C-Class', '206': 'C-Class',
        'WE': 'E-Class', 'WK': 'E-Class', '213': 'E-Class', '214': 'E-Class',
        'WV': 'S-Class', 'WZ': 'S-Class', '222': 'S-Class', '223': 'S-Class',
        'LE': 'CLA', 'LF': 'CLA', '117': 'CLA', '118': 'CLA',
        'LG': 'CLS', 'LH': 'CLS', '257': 'CLS',
        'XC': 'GLA', 'XD': 'GLA', '156': 'GLA',
        'XE': 'GLB', 'XF': 'GLB', '247': 'GLB',
        'XK': 'GLC', 'XL': 'GLC', '253': 'GLC', '254': 'GLC',
        'XM': 'GLE', 'XN': 'GLE', '166': 'GLE',
        'XP': 'GLS', 'XR': 'GLS', '167': 'GLS',
        'YB': 'G-Class', 'YC': 'G-Class', '463': 'G-Class', '464': 'G-Wagon',
    },
    'BMW': {
        'PT': '1 Series', 'PS': '1 Series', 'F40': '1 Series',
        'EV': '2 Series', 'EU': '2 Series', 'F44': '2 Series',
        'WG': '3 Series', 'WE': '3 Series', 'G20': '3 Series', 'G21': '3 Series Touring',
        'XG': '4 Series', 'XE': '4 Series', 'G22': '4 Series', 'G23': '4 Series Conv',
        'XW': '5 Series', 'XS': '5 Series', 'G30': '5 Series', 'G31': '5 Series Touring',
        'CA': '6 Series', 'CB': '6 Series', 'G32': '6 Series GT',
        'CY': '7 Series', 'CZ': '7 Series', 'G11': '7 Series', 'G12': '7 Series L',
        'CL': '8 Series', 'CM': '8 Series', 'G14': '8 Series', 'G15': '8 Series Coupe',
        'TX': 'X1', 'TY': 'X1', 'U11': 'X1', 'F48': 'X1',
        'UN': 'X2', 'UP': 'X2', 'F39': 'X2',
        'PA': 'X3', 'PB': 'X3', 'G01': 'X3',
        'UC': 'X4', 'UD': 'X4', 'G02': 'X4',
        'KS': 'X5', 'KT': 'X5', 'G05': 'X5',
        'KU': 'X6', 'KV': 'X6', 'G06': 'X6',
        'NC': 'X7', 'ND': 'X7', 'G07': 'X7',
        'BS': 'M3', 'BT': 'M3', 'WM': 'M4', 'WN': 'M4', 'XM': 'M5',
        'DS': 'Z4', 'DT': 'Z4', 'G29': 'Z4',
    },
    'Audi': {
        '8V': 'A3', '8Y': 'A3',
        '8W': 'A4', '8K': 'A4', 'B9': 'A4',
        'A5': 'A5', 'F5': 'A5',
        'A6': 'A6', 'C8': 'A6',
        'A7': 'A7', '4KA': 'A7',
        'A8': 'A8', '4N': 'A8', 'D5': 'A8',
        'GA': 'Q2', 'GB': 'Q2',
        '8U': 'Q3', 'F3': 'Q3',
        'FY': 'Q5', '80': 'Q5',
        '4M': 'Q7', '4L': 'Q7',
        '4NQ': 'Q8', 'F1': 'Q8',
        '4S': 'R8', '42': 'R8',
        '8S': 'TT', '8J': 'TT', 'FV': 'TT',
    },
    'Volkswagen': {
        'AU': 'Golf', 'CD': 'Golf', '1K': 'Golf', '5K': 'Golf',
        'BZ': 'Passat', '3C': 'Passat', '3G': 'Passat',
        'AN': 'Tiguan', 'AD': 'Tiguan', '5N': 'Tiguan',
        'CA': 'Atlas', 'CR': 'Atlas Cross Sport',
        'AW': 'Polo', '6R': 'Polo', 'AE': 'Polo',
        'BU': 'Jetta', 'A7': 'Jetta', '16': 'Jetta',
        '3H': 'Arteon', '3D': 'Phaeton', '7P': 'Touareg',
        'SY': 'ID.4', 'E1': 'ID.3', '7N': 'Sharan',
    },
    'Hyundai': {
        'AD': 'Elantra', 'CN7': 'Elantra', 'MD': 'Elantra',
        'DN8': 'Sonata', 'LF': 'Sonata', 'YF': 'Sonata',
        'JS': 'Veloster', 'FS': 'Veloster',
        'TM': 'Tucson', 'TL': 'Tucson', 'LM': 'Tucson',
        'DM': 'Santa Fe', 'CM': 'Santa Fe',
        'LX': 'Palisade', 'JX': 'Palisade',
        'NX4': 'Tucson', 'SU2': 'Kona', 'OS': 'Kona',
        'AC': 'Accent', 'RB': 'Accent', 'HC': 'Accent',
        'AE': 'Ioniq', 'NE': 'Ioniq 5', 'CE': 'Ioniq 6',
        'JK': 'Genesis G80', 'DH': 'Genesis G80',
        'RS': 'Genesis G90', 'HI': 'Genesis G90',
    },
    'Kia': {
        'YB': 'Rio', 'UB': 'Rio',
        'DL': 'K5', 'JF': 'Optima', 'TF': 'Optima',
        'CK': 'Stinger', 'UN': 'Sorento', 'UM': 'Sorento', 'XM': 'Sorento',
        'DE': 'Sportage', 'QL': 'Sportage', 'SL': 'Sportage', 'NQ': 'Sportage',
        'MV': 'Telluride', 'YN': 'Tucson',
        'SK': 'Soul', 'PS': 'Soul', 'AM': 'Soul',
        'S3': 'Carnival', 'KA': 'Carnival', 'YP': 'Sedona',
        'JC': 'Forte', 'YD': 'Forte', 'TD': 'Cerato', 'BD': 'Cerato',
        'NP': 'Seltos', 'SP': 'Seltos',
        'CV': 'EV6', 'NER': 'Niro', 'SG': 'Niro EV',
    },
    'Ford': {
        'AC': 'Mustang', 'S550': 'Mustang', 'S650': 'Mustang',
        'M8': 'Explorer', 'U6': 'Explorer',
        'J7': 'Escape', 'MK': 'Escape', 'CX': 'Escape',
        'D3': 'Edge', 'CD': 'Edge',
        'FT': 'F-150', 'FX': 'F-150', 'P5': 'F-150',
        'W14': 'F-250', 'W24': 'F-350',
        'RP': 'Expedition', 'U5': 'Expedition',
        'RS': 'Bronco', 'MR': 'Bronco Sport',
        'FH': 'Ranger', 'P7': 'Ranger',
        'E1': 'EcoSport', 'JK': 'Focus',
        'BX': 'Fusion', 'HS': 'Mach-E', '68': 'Transit',
    },
    'Chevrolet': {
        'A1': 'Camaro',
        'M1': 'Malibu', 'S1': 'Malibu',
        'K1': 'Spark', 'M3': 'Spark',
        'L1': 'Cruze', 'P1': 'Cruze',
        'R1': 'Equinox', 'XL': 'Equinox',
        'RV': 'Traverse', 'XC': 'Traverse', '1C': 'Traverse',
        'YC': 'Tahoe', 'C1': 'Tahoe',
        'YE': 'Suburban',
        'K2': 'Silverado', 'KC': 'Silverado', 'CK': 'Silverado',
        'TR': 'Trax', 'EW': 'Bolt', 'HM': 'Colorado',
        'CT': 'Corvette', 'Y2': 'Corvette', '1Y': 'Corvette',
    },
    'Porsche': {
        'ZZ': '911', '99': '911', 'CZ': '911 Carrera',
        'CA': 'Cayenne', 'PA': 'Cayenne', '9Y': 'Cayenne',
        'AF': 'Macan', '95B': 'Macan',
        'AE': 'Panamera', 'G1': 'Panamera', '971': 'Panamera',
        'J1': 'Taycan', 'Y1': 'Taycan',
        'CK': 'Boxster', 'ZA': 'Cayman', '98': 'Boxster/Cayman',
    },
    'Land Rover': {
        'AK': 'Range Rover', 'GL': 'Range Rover',
        'AL': 'Range Rover Sport', 'L3': 'Range Rover Sport',
        'EV': 'Range Rover Evoque', 'LV': 'Evoque',
        'VE': 'Range Rover Velar', 'LY': 'Velar',
        'LR': 'Discovery', 'L4': 'Discovery',
        'LC': 'Discovery Sport', 'L5': 'Discovery Sport',
        'ND': 'Defender', 'L6': 'Defender', 'LE': 'Defender',
    },
    'Jaguar': {
        'CC': 'XE', 'X760': 'XE',
        'CD': 'XF', 'X260': 'XF',
        'CE': 'XJ', 'X351': 'XJ',
        'CF': 'F-Type', 'X152': 'F-Type',
        'DC': 'F-Pace', 'X761': 'F-Pace',
        'EV': 'E-Pace', 'X540': 'E-Pace',
        'I': 'I-Pace', 'X590': 'I-Pace',
    },
    'Mazda': {
        'BM': 'Mazda3', 'BP': 'Mazda3', 'BK': 'Mazda3', 'BL': 'Mazda3',
        'GJ': 'Mazda6', 'GY': 'Mazda6', 'GH': 'Mazda6', 'GL': 'Mazda6',
        'KF': 'CX-5', 'KE': 'CX-5', 'PW': 'CX-5',
        'CK': 'CX-30', 'DM': 'CX-30',
        'TB': 'CX-9', 'TC': 'CX-9', 'CW': 'CX-9',
        'KG': 'CX-50', 'KH': 'CX-60', 'KJ': 'CX-90',
        'NC': 'MX-5 Miata', 'ND': 'MX-5 Miata', 'NB': 'MX-5 Miata',
        'DJ': 'Mazda2', 'DE': 'Mazda2', 'DY': 'Mazda2',
    },
    'Subaru': {
        'GK': 'Impreza', 'GJ': 'Impreza', 'GP': 'Impreza',
        'GT': 'XV/Crosstrek', 'GU': 'Crosstrek',
        'SK': 'Forester', 'SJ': 'Forester', 'SH': 'Forester',
        'BN': 'Outback', 'BS': 'Outback', 'BR': 'Outback',
        'VB': 'WRX', 'VA': 'WRX', 'VN': 'WRX STI',
        'BM': 'Legacy', 'BA': 'Legacy', 'BK': 'Levorg',
        'SKA': 'Ascent', 'YA': 'Solterra', 'E3': 'BRZ',
    },
    'Suzuki': {
        'JB': 'Jimny', 'JA': 'Jimny', 'JB7': 'Jimny',
        'JT': 'Swift', 'ZC': 'Swift', 'ZD': 'Swift',
        'YA': 'Vitara', 'YB': 'Vitara', 'LY': 'Grand Vitara',
        'MH': 'Wagon R', 'MR': 'Swift Sport',
        'RA': 'Alto', 'MA': 'Celerio', 'EW': 'Baleno',
    },
    'Fiat': {
        '312': '500', '334': '500X', '356': '500L',
        '940': 'Tipo', '199': 'Punto', '350': 'Ducato',
    },
    'Ferrari': {
        'H': '458', 'F': '488', 'K': 'F8', 'L': 'SF90',
        'A': 'Roma', 'P': 'Portofino', 'R': '812',
    },
    // Mitsubishi - Popular in Middle East
    'Mitsubishi': {
        'GG': 'Outlander', 'GF': 'Outlander', 'CW': 'Outlander',
        'GA': 'ASX', 'XA': 'ASX',
        'KA': 'Pajero', 'V8': 'Pajero', 'V9': 'Pajero',
        'KS': 'Pajero Sport', 'KR': 'Pajero Sport',
        'KB': 'Triton', 'MQ': 'Triton', 'MR': 'Triton',
        'CY': 'Lancer', 'CZ': 'Lancer', 'CS': 'Lancer',
        'GS': 'Eclipse Cross', 'YA': 'Eclipse Cross',
        'LA': 'Mirage', 'A03': 'Mirage', 'A05': 'Attrage',
        'HA': 'Xpander', 'NC': 'Montero',
    },
    // Chinese Brands - Popular in Qatar
    'Chery': {
        'J': 'Tiggo 8', 'T': 'Tiggo 7', 'F': 'Tiggo 4',
        'E': 'Tiggo 3', 'A': 'Arrizo 6', 'C': 'Arrizo 5',
        'K': 'Tiggo 8 Pro', 'L': 'Tiggo 7 Pro',
    },
    'Geely': {
        'FY': 'Coolray', 'NL': 'Azkarra', 'BE': 'Emgrand',
        'SX': 'Tugella', 'KX': 'Monjaro', 'GC': 'GC9',
        'CK': 'CK', 'MK': 'MK',
    },
    'BYD': {
        'SE': 'Seal', 'AT': 'Atto 3', 'HA': 'Han',
        'TA': 'Tang', 'SO': 'Song', 'YU': 'Yuan',
        'DO': 'Dolphin', 'QI': 'Qin', 'E6': 'E6',
    },
    'Haval': {
        'H6': 'H6', 'H2': 'H2', 'H9': 'H9',
        'JO': 'Jolion', 'F7': 'F7', 'F5': 'F5',
        'DA': 'Dargo', 'H4': 'H4', 'M6': 'M6',
    },
    'Great Wall': {
        'PO': 'Poer', 'WI': 'Wingle', 'ST': 'Steed',
        'C3': 'C30', 'C5': 'C50', 'M4': 'M4',
    },
    'MG': {
        'ZS': 'ZS', 'HS': 'HS', 'RX': 'RX5',
        'GT': 'GT', 'MG': 'MG5', '6': 'MG6',
        'EP': 'EP Plus', 'ON': 'One', 'MA': 'Marvel R',
    },
    'Changan': {
        'CS': 'CS75', 'C7': 'CS75 Plus', 'C5': 'CS55',
        'C3': 'CS35', 'UN': 'UNI-T', 'UK': 'UNI-K',
        'EA': 'Eado', 'AL': 'Alsvin',
    },
    'JAC': {
        'S2': 'JS2', 'S3': 'JS3', 'S4': 'JS4',
        'S6': 'JS6', 'S7': 'JS7', 'T6': 'T6', 'T8': 'T8',
    },
    'Dongfeng': {
        'AX': 'AX7', 'A7': 'AX7 Plus', 'A5': 'AX5',
        'A3': 'AX3', 'SX': 'SX5', 'SX6': 'SX6',
    },
    'GAC': {
        'GS': 'GS8', 'G8': 'GS8', 'G4': 'GS4',
        'G3': 'GS3', 'GM': 'GM8', 'EM': 'Empow',
        'AI': 'Aion S', 'AY': 'Aion Y', 'AV': 'Aion V',
    },
    'Hongqi': {
        'H5': 'H5', 'H7': 'H7', 'H9': 'H9',
        'E3': 'E-HS3', 'E9': 'E-HS9', 'HS': 'HS5',
    },
    'Tank': {
        '30': 'Tank 300', '50': 'Tank 500', '70': 'Tank 700',
        'T3': 'Tank 300', 'T5': 'Tank 500',
    },
    'Jetour': {
        'X7': 'X70', 'X9': 'X90', 'DA': 'Dashing',
        'T2': 'T2', 'X5': 'X50',
    },
    'Exeed': {
        'TX': 'TXL', 'VX': 'VX', 'LX': 'LX',
        'RX': 'RX', 'YA': 'Yaoguang',
    },
    // SsangYong - Korean
    'SsangYong': {
        'RE': 'Rexton', 'RX': 'Rexton', 'Y4': 'Rexton',
        'KO': 'Korando', 'C2': 'Korando', 'TI': 'Tivoli',
        'MU': 'Musso', 'AC': 'Actyon', 'RO': 'Rodius',
        'TO': 'Torres', 'KU': 'Kyron',
    },
    // Genesis - Korean Luxury
    'Genesis': {
        'G7': 'G70', 'G8': 'G80', 'G9': 'G90',
        'GV': 'GV70', 'V8': 'GV80', 'X3': 'GV60',
    },
    // Infiniti - Japanese Luxury
    'Infiniti': {
        'Q5': 'Q50', 'Q6': 'Q60', 'Q7': 'Q70',
        'QX': 'QX50', 'X5': 'QX55', 'X6': 'QX60', 'X8': 'QX80',
        'FX': 'FX', 'EX': 'EX', 'JX': 'JX',
    },
};

/**
 * Decode VIN locally using standard VIN format
 * For production, integrate with NHTSA API or similar
 */
const decodeVINLocally = (vin: string): DecodedVIN | null => {
    if (vin.length !== 17) return null;

    const upperVIN = vin.toUpperCase();
    const wmi = upperVIN.substring(0, 3);
    const yearChar = upperVIN.charAt(9);
    const plantChar = upperVIN.charAt(10);

    // Get manufacturer
    const manufacturer = MANUFACTURER_CODES[wmi];
    if (!manufacturer) {
        // Try partial match (first 2 chars)
        const partialWMI = upperVIN.substring(0, 2);
        for (const [code, data] of Object.entries(MANUFACTURER_CODES)) {
            if (code.startsWith(partialWMI)) {
                const year = YEAR_CODES[yearChar] || 'Unknown';
                const vds = upperVIN.substring(3, 8);
                const models = MODEL_DATABASE[data.make] || {};
                let model = 'Unknown Model';

                for (let len = 3; len >= 1; len--) {
                    const pattern = vds.substring(0, len);
                    if (models[pattern]) {
                        model = models[pattern];
                        break;
                    }
                }

                return {
                    make: data.make,
                    model: model,
                    year: year,
                    country: data.country,
                };
            }
        }
        return null;
    }

    const year = YEAR_CODES[yearChar] || 'Unknown';

    // Try to find model using VDS section (positions 4-8)
    const vds = upperVIN.substring(3, 8);
    const models = MODEL_DATABASE[manufacturer.make] || {};
    let model = 'Unknown Model';

    // Try different VDS pattern lengths for matching
    for (let len = 3; len >= 1; len--) {
        const pattern = vds.substring(0, len);
        if (models[pattern]) {
            model = models[pattern];
            break;
        }
    }

    // Also try character at position 4 and 5 individually
    if (model === 'Unknown Model') {
        const char4 = vds.charAt(0);
        const char5 = vds.charAt(1);
        if (models[char4 + char5]) {
            model = models[char4 + char5];
        } else if (models[char4]) {
            model = models[char4];
        }
    }

    return {
        make: manufacturer.make,
        model: model,
        year: year,
        country: manufacturer.country,
    };
};

/**
 * NHTSA VIN Decoder API - Official US Government Free API
 * Provides near-100% accuracy for vehicle identification
 * API Docs: https://vpic.nhtsa.dot.gov/api/
 */
const NHTSA_API_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevin';

interface NHTSAResult {
    Value: string | null;
    ValueId: string | null;
    Variable: string;
    VariableId: number;
}

interface NHTSAResponse {
    Count: number;
    Message: string;
    Results: NHTSAResult[];
    SearchCriteria: string;
}

const decodeVINWithAPI = async (vin: string): Promise<DecodedVIN | null> => {
    try {
        const response = await fetch(`${NHTSA_API_URL}/${vin}?format=json`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.log('NHTSA API error:', response.status);
            return null;
        }

        const data: NHTSAResponse = await response.json();

        if (!data.Results || data.Results.length === 0) {
            return null;
        }

        // Helper to extract value by variable name
        const getValue = (variableName: string): string => {
            const result = data.Results.find(r => r.Variable === variableName);
            return result?.Value?.trim() || '';
        };

        const make = getValue('Make');
        const model = getValue('Model');
        const year = getValue('Model Year');

        // If essential fields are missing, return null
        if (!make || !year) {
            return null;
        }

        return {
            make: make,
            model: model || 'Unknown',
            year: year,
            bodyType: getValue('Body Class') || undefined,
            engineSize: getValue('Displacement (L)') ? `${getValue('Displacement (L)')}L` : undefined,
            fuelType: getValue('Fuel Type - Primary') || undefined,
            driveType: getValue('Drive Type') || undefined,
            transmission: getValue('Transmission Style') || undefined,
            country: getValue('Plant Country') || getValue('Manufacturer Name')?.split(' ')[0] || undefined,
        };
    } catch (error) {
        console.log('NHTSA API fetch error:', error);
        return null;
    }
};

/**
 * Validate VIN format
 */
const validateVIN = (vin: string): { valid: boolean; error?: string } => {
    if (vin.length !== 17) {
        return { valid: false, error: `VIN must be 17 characters (currently ${vin.length})` };
    }

    // Check for invalid characters (I, O, Q not allowed)
    if (/[IOQ]/i.test(vin)) {
        return { valid: false, error: 'VIN cannot contain I, O, or Q' };
    }

    // Check alphanumeric
    if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
        return { valid: false, error: 'VIN contains invalid characters' };
    }

    return { valid: true };
};

/**
 * Premium VIN Decoder Component
 * Auto-decodes VIN to populate vehicle info
 */
export const VINDecoder: React.FC<VINDecoderProps> = ({
    value,
    onChangeText,
    onDecoded,
}) => {
    const [isDecoding, setIsDecoding] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [decodedInfo, setDecodedInfo] = useState<DecodedVIN | null>(null);

    const handleDecode = async () => {
        if (!value) {
            Alert.alert('Enter VIN', 'Please enter a VIN number to decode');
            return;
        }

        const validation = validateVIN(value);
        if (!validation.valid) {
            setValidationError(validation.error || 'Invalid VIN');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
        }

        setIsDecoding(true);
        setValidationError(null);

        try {
            // Try NHTSA API first for accurate results
            let decoded = await decodeVINWithAPI(value);
            let usedAPI = true;

            // Fallback to local database if API fails
            if (!decoded) {
                console.log('NHTSA API failed, using local database');
                decoded = decodeVINLocally(value);
                usedAPI = false;
            }

            if (decoded) {
                setDecodedInfo(decoded);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                if (onDecoded) {
                    onDecoded(decoded);
                }

                // Build detailed info string
                let details = `Vehicle: ${decoded.year} ${decoded.make} ${decoded.model}`;
                if (decoded.bodyType) details += `\nBody: ${decoded.bodyType}`;
                if (decoded.engineSize) details += `\nEngine: ${decoded.engineSize}`;
                if (decoded.fuelType) details += `\nFuel: ${decoded.fuelType}`;
                if (decoded.country) details += `\nOrigin: ${decoded.country}`;
                if (!usedAPI) details += `\n\n⚠️ Offline mode - partial results`;

                Alert.alert(
                    '✅ VIN Decoded!',
                    details,
                    [
                        { text: 'Auto-Fill', onPress: () => onDecoded?.(decoded!), style: 'default' },
                        { text: 'Cancel', style: 'cancel' },
                    ]
                );
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert(
                    'Unknown VIN',
                    'Could not decode this VIN. Please enter vehicle details manually.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.log('VIN decode error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Failed to decode VIN');
        } finally {
            setIsDecoding(false);
        }
    };

    const handleTextChange = (text: string) => {
        // Auto uppercase and remove invalid chars
        const cleaned = text.toUpperCase().replace(/[IOQ]/g, '');
        onChangeText(cleaned);

        // Clear validation when typing
        if (validationError) {
            setValidationError(null);
        }

        // Clear decoded info when VIN changes
        if (decodedInfo) {
            setDecodedInfo(null);
        }
    };

    const isValid = value.length === 17 && !validationError;

    return (
        <View style={styles.container}>
            <View style={styles.cardWrapper}>
                <LinearGradient
                    colors={['#22c55e', '#16a34a']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.accentBar}
                />
                <View style={styles.cardContent}>
                    <View style={styles.labelRow}>
                        <Text style={styles.labelIcon}>🔐</Text>
                        <Text style={styles.label}>VIN / Chassis Number</Text>
                        <View style={styles.optionalBadge}>
                            <Text style={styles.optionalText}>SMART FILL</Text>
                        </View>
                    </View>
                    <Text style={styles.hint}>
                        💡 Enter 17-character VIN to auto-fill vehicle info
                    </Text>

                    {/* VIN Input - Full Width */}
                    <TextInput
                        style={[
                            styles.input,
                            validationError && styles.inputError,
                            isValid && styles.inputValid,
                        ]}
                        placeholder="1HGCG5655WA042039"
                        placeholderTextColor="#B0B0B0"
                        value={value}
                        onChangeText={handleTextChange}
                        autoCapitalize="characters"
                        maxLength={17}
                    />

                    {/* Character Counter */}
                    <View style={styles.charRow}>
                        <View style={styles.charProgress}>
                            <View style={[
                                styles.charProgressFill,
                                { width: `${(value.length / 17) * 100}%` },
                                value.length === 17 && styles.charProgressComplete,
                            ]} />
                        </View>
                        <Text style={[
                            styles.charCount,
                            value.length === 17 && styles.charCountValid,
                        ]}>
                            {value.length}/17 characters
                        </Text>
                    </View>

                    {/* Decode Button - Full Width */}
                    <TouchableOpacity
                        style={[styles.decodeButton, !value && styles.decodeButtonDisabled]}
                        onPress={handleDecode}
                        disabled={!value || isDecoding}
                    >
                        <LinearGradient
                            colors={value ? ['#22c55e', '#16a34a'] : ['#d1d5db', '#9ca3af']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.decodeGradient}
                        >
                            {isDecoding ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Text style={styles.decodeIcon}>🔍</Text>
                                    <Text style={styles.decodeText}>Decode VIN</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {validationError && (
                        <Text style={styles.errorText}>⚠️ {validationError}</Text>
                    )}

                    {decodedInfo && (
                        <View style={styles.resultCard}>
                            <Text style={styles.resultTitle}>✅ Decoded Vehicle</Text>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>Make:</Text>
                                <Text style={styles.resultValue}>{decodedInfo.make}</Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>Model:</Text>
                                <Text style={styles.resultValue}>{decodedInfo.model}</Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Text style={styles.resultLabel}>Year:</Text>
                                <Text style={styles.resultValue}>{decodedInfo.year}</Text>
                            </View>
                            {decodedInfo.country && (
                                <View style={styles.resultRow}>
                                    <Text style={styles.resultLabel}>Origin:</Text>
                                    <Text style={styles.resultValue}>{decodedInfo.country}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: Spacing.lg,
    },
    cardWrapper: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    accentBar: {
        height: 4,
    },
    cardContent: {
        padding: Spacing.md,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    labelIcon: {
        fontSize: 16,
        marginRight: Spacing.xs,
    },
    label: {
        fontSize: FontSizes.md,
        fontWeight: '700',
        color: Colors.dark.text,
    },
    optionalBadge: {
        marginLeft: 'auto',
        backgroundColor: '#22c55e15',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    optionalText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#16a34a',
        letterSpacing: 0.5,
    },
    hint: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        marginBottom: Spacing.md,
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.lg,
        fontSize: 14,
        color: Colors.dark.text,
        borderWidth: 2,
        borderColor: '#E8E8E8',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        letterSpacing: 1.5,
        textAlign: 'center',
        minHeight: 56,
    },
    inputError: {
        borderColor: Colors.error,
        backgroundColor: Colors.error + '10',
    },
    inputValid: {
        borderColor: '#22c55e',
        backgroundColor: '#22c55e10',
    },
    charRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    charProgress: {
        flex: 1,
        height: 4,
        backgroundColor: '#E8E8E8',
        borderRadius: 2,
        overflow: 'hidden',
    },
    charProgressFill: {
        height: '100%',
        backgroundColor: '#9CA3AF',
        borderRadius: 2,
    },
    charProgressComplete: {
        backgroundColor: '#22c55e',
    },
    charCount: {
        fontSize: FontSizes.xs,
        color: Colors.dark.textMuted,
        fontWeight: '500',
    },
    charCountValid: {
        color: '#22c55e',
        fontWeight: '700',
    },
    decodeButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        ...Shadows.md,
    },
    decodeButtonDisabled: {
        opacity: 0.5,
    },
    decodeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        height: 52,
    },
    decodeIcon: {
        fontSize: 20,
        marginRight: Spacing.sm,
    },
    decodeText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: FontSizes.lg,
        letterSpacing: 0.5,
    },
    errorText: {
        fontSize: FontSizes.sm,
        color: Colors.error,
        marginTop: Spacing.xs,
    },
    resultCard: {
        marginTop: Spacing.md,
        backgroundColor: '#22c55e15',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: '#22c55e40',
    },
    resultTitle: {
        fontSize: FontSizes.sm,
        fontWeight: '700',
        color: '#16a34a',
        marginBottom: Spacing.sm,
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    resultLabel: {
        fontSize: FontSizes.sm,
        color: Colors.dark.textSecondary,
    },
    resultValue: {
        fontSize: FontSizes.sm,
        fontWeight: '600',
        color: Colors.dark.text,
    },
});



export default VINDecoder;
