/**
 * Predictive Maintenance Service
 * Analyzes user history to suggest upcoming services.
 */

export class PredictiveService {

    // Maintenance Rules (Simplified Knowledge Base)
    private static rules = [
        {
            trigger_part: 'brake pads',
            suggestion: 'Brake Fluid Check',
            reason: 'Brake fluid often needs checking when pads are worn.',
            due_in_months: 6
        },
        {
            trigger_part: 'battery',
            suggestion: 'Alternator Check',
            reason: 'A failing alternator can damage new batteries.',
            due_in_months: 1
        },
        {
            trigger_part: 'oil filter',
            suggestion: 'Oil Change',
            reason: 'Regular oil changes are vital for engine health.',
            due_in_months: 3
        },
        {
            trigger_part: 'tire',
            suggestion: 'Wheel Alignment',
            reason: 'New tires last longer with proper alignment.',
            due_in_months: 0 // Immediate
        }
    ];

    /**
     * Get maintenance suggestions for a user based on their last purchase.
     */
    getSuggestions(lastPartPurchased: string) {
        const product = lastPartPurchased.toLowerCase();

        // Find matching rules
        const matches = PredictiveService.rules.filter(rule =>
            product.includes(rule.trigger_part)
        );

        return matches.map(rule => ({
            service_name: rule.suggestion,
            reason: rule.reason,
            recommended_date: this.addMonths(new Date(), rule.due_in_months)
        }));
    }

    private addMonths(date: Date, months: number): Date {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d;
    }
}

export const predictiveService = new PredictiveService();
