// Order status configuration helpers
// Extracted from OrderDetailScreen

export const getStatusConfig = (status: string, t: any) => {
    const configs: Record<string, {
        color: string;
        icon: string;
        label: string;
        description: string;
        gradient: readonly [string, string];
    }> = {
        'pending_payment': {
            color: '#F59E0B', icon: 'card-outline', label: t('status.awaitingPayment') || 'Awaiting Payment',
            description: 'Complete payment to confirm your order',
            gradient: ['#F59E0B', '#D97706'] as const
        },
        'confirmed': {
            color: '#3B82F6', icon: 'checkmark', label: t('status.confirmed'),
            description: t('status.confirmedDesc'),
            gradient: ['#3B82F6', '#2563EB'] as const
        },
        'preparing': {
            color: '#F59E0B', icon: 'construct-outline', label: t('status.preparing'),
            description: t('status.preparingDesc'),
            gradient: ['#F59E0B', '#D97706'] as const
        },
        'ready_for_pickup': {
            color: '#8B5CF6', icon: 'cube-outline', label: t('status.readyForPickup'),
            description: t('status.readyDesc'),
            gradient: ['#8B5CF6', '#7C3AED'] as const
        },
        'collected': {
            color: '#22C55E', icon: 'truck-outline', label: t('status.inTransit'),
            description: t('status.processingDesc'),
            gradient: ['#22C55E', '#16A34A'] as const
        },
        'qc_in_progress': {
            color: '#22C55E', icon: 'truck-outline', label: t('status.inTransit'),
            description: t('status.qcDesc'),
            gradient: ['#22C55E', '#16A34A'] as const
        },
        'qc_passed': {
            color: '#22C55E', icon: 'truck-outline', label: t('status.inTransit'),
            description: t('status.qcPassedDesc'),
            gradient: ['#22C55E', '#16A34A'] as const
        },
        'qc_failed': {
            color: '#F59E0B', icon: 'hourglass-outline', label: t('status.processing'),
            description: t('status.issueDesc'),
            gradient: ['#F59E0B', '#D97706'] as const
        },
        'in_transit': {
            color: '#22C55E', icon: 'car-sport-outline', label: t('status.onTheWay'),
            description: t('status.onTheWayDesc'),
            gradient: ['#22C55E', '#16A34A'] as const
        },
        'delivered': {
            color: '#06B6D4', icon: 'location-outline', label: t('status.delivered'),
            description: t('status.deliveredDesc'),
            gradient: ['#06B6D4', '#0891B2'] as const
        },
        'completed': {
            color: '#22C55E', icon: 'ribbon-outline', label: t('status.completed'),
            description: t('status.completedDesc'),
            gradient: ['#22C55E', '#16A34A'] as const
        },
        'cancelled_by_customer': {
            color: '#EF4444', icon: 'close', label: t('status.cancelled'),
            description: t('status.cancelledUserDesc'),
            gradient: ['#EF4444', '#DC2626'] as const
        },
        'cancelled_by_garage': {
            color: '#EF4444', icon: 'close', label: t('status.cancelled'),
            description: t('status.cancelledGarageDesc'),
            gradient: ['#EF4444', '#DC2626'] as const
        },
        'cancelled_by_ops': {
            color: '#EF4444', icon: 'close', label: t('status.cancelled'),
            description: t('status.cancelledSupportDesc'),
            gradient: ['#EF4444', '#DC2626'] as const
        },
        'disputed': {
            color: '#F59E0B', icon: 'warning-outline', label: t('status.disputed'),
            description: t('status.disputedDesc'),
            gradient: ['#F59E0B', '#D97706'] as const
        },
        'refunded': {
            color: '#6B7280', icon: 'cash-outline', label: t('status.refunded'),
            description: t('status.refundedDesc'),
            gradient: ['#6B7280', '#4B5563'] as const
        },
    };
    return configs[status] || {
        color: '#6B7280', icon: 'help-circle-outline', label: status.replace(/_/g, ' '), description: '',
        gradient: ['#6B7280', '#4B5563'] as const
    };
};

export const getTimelineSteps = (status: string, t: any) => {
    const allSteps = [
        { key: 'confirmed', label: t('status.confirmed'), icon: 'checkmark' },
        { key: 'preparing', label: t('status.preparing'), icon: 'construct-outline' },
        { key: 'ready_for_pickup', label: t('status.ready'), icon: 'cube-outline' },
        { key: 'in_transit', label: t('status.inTransit'), icon: 'truck-outline' },
        { key: 'delivered', label: t('status.delivered'), icon: 'location-outline' },
    ];

    const statusToStep: Record<string, number> = {
        'confirmed': 0, 'preparing': 1, 'ready_for_pickup': 2,
        'collected': 3, 'qc_in_progress': 3, 'qc_passed': 3, 'qc_failed': 3,
        'in_transit': 3, 'delivered': 4, 'completed': 4,
    };

    return { steps: allSteps, currentStep: statusToStep[status] ?? 0 };
};
