// QScrap Driver App - Premium Theme
// Driver-focused color scheme (amber/orange for visibility)

export const Colors = {
    // Primary brand colors - Amber/Orange for driver identity
    primary: '#f59e0b',      // Amber-500 - main action color
    primaryDark: '#d97706',  // Amber-600 - pressed states
    primaryLight: '#fbbf24', // Amber-400 - highlights

    // Status colors
    success: '#10b981',      // Emerald-500
    warning: '#f59e0b',      // Amber-500
    danger: '#ef4444',       // Red-500
    info: '#3b82f6',         // Blue-500

    // Assignment status colors
    assigned: '#3b82f6',     // Blue - new assignment
    pickedUp: '#8b5cf6',     // Purple - collected
    inTransit: '#f59e0b',    // Amber - on the way
    delivered: '#10b981',    // Green - completed
    failed: '#ef4444',       // Red - failed

    // Dark theme (driver default - easier on eyes during night driving)
    dark: {
        background: '#0f172a',      // Slate-900
        surface: '#1e293b',         // Slate-800
        surfaceElevated: '#334155', // Slate-700
        text: '#f8fafc',            // Slate-50
        textSecondary: '#94a3b8',   // Slate-400
        textMuted: '#64748b',       // Slate-500
        border: '#334155',          // Slate-700
        card: '#1e293b',            // Slate-800
    },

    // Light theme
    light: {
        background: '#f8fafc',      // Slate-50
        surface: '#ffffff',
        surfaceElevated: '#f1f5f9', // Slate-100
        text: '#0f172a',            // Slate-900
        textSecondary: '#475569',   // Slate-600
        textMuted: '#94a3b8',       // Slate-400
        border: '#e2e8f0',          // Slate-200
        card: '#ffffff',
    },
};

// Assignment status display config
export const AssignmentStatusConfig = {
    assigned: {
        label: 'Assigned',
        color: Colors.assigned,
        icon: '📋',
        actionLabel: 'Start Pickup',
    },
    picked_up: {
        label: 'Picked Up',
        color: Colors.pickedUp,
        icon: '📦',
        actionLabel: 'Start Delivery',
    },
    in_transit: {
        label: 'In Transit',
        color: Colors.inTransit,
        icon: '🚚',
        actionLabel: 'Complete Delivery',
    },
    delivered: {
        label: 'Delivered',
        color: Colors.delivered,
        icon: '✅',
        actionLabel: null,
    },
    failed: {
        label: 'Failed',
        color: Colors.failed,
        icon: '❌',
        actionLabel: null,
    },
};

// Assignment type display config
export const AssignmentTypeConfig = {
    collection: {
        label: 'Collection',
        description: 'Pick up from garage',
        icon: '🏪',
        color: '#8b5cf6', // Purple
    },
    delivery: {
        label: 'Delivery',
        description: 'Deliver to customer',
        icon: '📦',
        color: '#3b82f6', // Blue
    },
    return_to_garage: {
        label: 'Return',
        description: 'Return to garage',
        icon: '↩️',
        color: '#f59e0b', // Amber
    },
};
