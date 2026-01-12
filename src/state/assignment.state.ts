
export type AssignmentStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';

export class AssignmentState {
    private static readonly VALID_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
        'assigned': ['picked_up', 'in_transit', 'delivered'], // Allow direct completion (robustness)
        'picked_up': ['in_transit', 'delivered'], // Allow skipping in_transit
        'in_transit': ['delivered', 'failed'],
        'delivered': [], // Terminal state
        'failed': []     // Terminal state
    };

    static isValidTransition(currentStatus: string, newStatus: string): boolean {
        const allowed = this.VALID_TRANSITIONS[currentStatus as AssignmentStatus];
        return allowed ? allowed.includes(newStatus as AssignmentStatus) : false;
    }

    static getAllowedTransitions(currentStatus: string): string[] {
        return this.VALID_TRANSITIONS[currentStatus as AssignmentStatus] || [];
    }
}
