// Comprehensive Car Part Categories for QScrap
// Organized for easy selection

export const PART_CATEGORIES = [
    'Engine & Cooling',
    'Transmission & Drivetrain',
    'Suspension & Steering',
    'Brakes & ABS',
    'Body & Exterior',
    'Interior & Upholstery',
    'Lights & electrical',
    'HVAC (Heating & A/C)',
    'Exhaust system',
    'Fuel system',
    'Wheels & Tires',
    'Audio & Electronics',
    'Glass & Windows',
    'Sensors & ADAS',
    'Hybrid & EV Components',
    'Other / Uncategorized'
];

export const PART_SUBCATEGORIES: Record<string, string[]> = {
    'Engine & Cooling': ['Long Block', 'Short Block', 'Cylinder Head', 'Turbocharger', 'Radiator', 'Water Pump', 'Alternator', 'Starter', 'Engine Mount', 'Oil Pan', 'Intake Manifold'],
    'Transmission & Drivetrain': ['Transmission Assembly', 'Transmission Control Module', 'Axle Shaft', 'Driveshaft', 'Differential', 'Transfer Case', 'Clutch Kit', 'Flywheel'],
    'Suspension & Steering': ['Strut / Shock Absorber', 'Control Arm', 'Steering Rack', 'Power Steering Pump', 'Knuckle / Spindle', 'Sway Bar', 'Wheel Hub / Bearing', 'Coil Spring'],
    'Brakes & ABS': ['ABS Pump / Module', 'Brake Caliper', 'Master Cylinder', 'Brake Booster', 'Parking Brake Actuator', 'Disc / Rotor'],
    'Body & Exterior': ['Bumper (Front)', 'Bumper (Rear)', 'Hood', 'Fender', 'Door Shell', 'Trunk Lid / Tailgate', 'Side Mirror', 'Grille', 'Headlight', 'Taillight', 'Door Handle'],
    'Interior & Upholstery': ['Seat (Front)', 'Seat (Rear)', 'Door Panel', 'Dashboard', 'Speedometer / Cluster', 'Steering Wheel', 'Center Console', 'Headliner', 'Carpet', 'Airbag'],
    'Lights & electrical': ['Headlight Assembly', 'Taillight Assembly', 'Fog Light', 'Turn Signal', 'Interior Light', 'Fuse Box', 'Wiring Harness', 'Battery'],
    'HVAC (Heating & A/C)': ['A/C Compressor', 'Condenser', 'Evaporator Core', 'Heater Core', 'Blower Motor', 'Climate Control Panel'],
    'Exhaust system': ['Muffler', 'Catalytic Converter', 'Exhaust Manifold', 'Exhaust Pipe', 'Resonator'],
    'Fuel system': ['Fuel Pump', 'Fuel Injector', 'Fuel Tank', 'Throttle Body', 'Fuel Rail'],
    'Wheels & Tires': ['Alloy Wheel', 'Steel Wheel', 'Spare Tire', 'Tire Pressure Sensor (TPMS)', 'Wheel Cover / Cap'],
    'Audio & Electronics': ['Radio / Head Unit', 'Amplifier', 'Speaker', 'Navigation Module', 'Backup Camera', 'DVD Player'],
    'Glass & Windows': ['Windshield', 'Door Glass', 'Back Glass', 'Quarter Glass', 'Sunroof Glass', 'Window Regulator'],
    'Sensors & ADAS': ['Oxygen Sensor', 'Mass Air Flow Sensor (MAF)', 'Camshaft Sensor', 'Crankshaft Sensor', 'Parking Sensor', 'Radar Sensor', 'Lane Camera'],
    'Hybrid & EV Components': ['Hybrid Battery Pack', 'Inverter / Converter', 'Electric Motor', 'Charging Port'],
    'Other / Uncategorized': ['Miscellaneous']
};
