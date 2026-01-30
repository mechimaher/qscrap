/**
 * QScrap Driver App - Circuit Breaker Pattern
 * P1 IMPROVEMENT: Protects against cascading failures from external APIs
 * 
 * Pattern: If an external service fails repeatedly, "open" the circuit
 * to fail fast and prevent resource exhaustion. After a timeout, try again.
 */

interface CircuitBreakerConfig {
    failureThreshold: number;       // Number of failures before opening
    successThreshold: number;       // Number of successes to close after half-open
    timeout: number;                // Ms before trying again after opening
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitStats {
    failures: number;
    successes: number;
    lastFailureTime: number;
    state: CircuitState;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 3,      // Open after 3 consecutive failures
    successThreshold: 2,      // Close after 2 successes in half-open
    timeout: 30000,           // 30 seconds before retry
};

class CircuitBreaker {
    private circuits: Map<string, CircuitStats> = new Map();
    private config: CircuitBreakerConfig;

    constructor(config: Partial<CircuitBreakerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    private getCircuit(name: string): CircuitStats {
        if (!this.circuits.has(name)) {
            this.circuits.set(name, {
                failures: 0,
                successes: 0,
                lastFailureTime: 0,
                state: 'CLOSED',
            });
        }
        return this.circuits.get(name)!;
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute<T>(
        name: string,
        fn: () => Promise<T>,
        fallback?: () => T | Promise<T>
    ): Promise<T> {
        const circuit = this.getCircuit(name);

        // Check if circuit should transition from OPEN to HALF_OPEN
        if (circuit.state === 'OPEN') {
            const timeSinceFailure = Date.now() - circuit.lastFailureTime;
            if (timeSinceFailure >= this.config.timeout) {
                console.log(`[CircuitBreaker] ${name}: OPEN → HALF_OPEN (timeout elapsed)`);
                circuit.state = 'HALF_OPEN';
                circuit.successes = 0;
            } else {
                // Circuit is still open - fail fast
                console.log(`[CircuitBreaker] ${name}: OPEN - failing fast (${Math.round((this.config.timeout - timeSinceFailure) / 1000)}s remaining)`);
                if (fallback) {
                    return fallback();
                }
                throw new Error(`Circuit breaker OPEN for ${name}`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess(name, circuit);
            return result;
        } catch (error) {
            this.onFailure(name, circuit);
            if (fallback) {
                console.log(`[CircuitBreaker] ${name}: Using fallback`);
                return fallback();
            }
            throw error;
        }
    }

    private onSuccess(name: string, circuit: CircuitStats): void {
        if (circuit.state === 'HALF_OPEN') {
            circuit.successes++;
            console.log(`[CircuitBreaker] ${name}: HALF_OPEN success ${circuit.successes}/${this.config.successThreshold}`);

            if (circuit.successes >= this.config.successThreshold) {
                console.log(`[CircuitBreaker] ${name}: HALF_OPEN → CLOSED`);
                circuit.state = 'CLOSED';
                circuit.failures = 0;
                circuit.successes = 0;
            }
        } else if (circuit.state === 'CLOSED') {
            // Reset failure count on success
            circuit.failures = 0;
        }
    }

    private onFailure(name: string, circuit: CircuitStats): void {
        circuit.failures++;
        circuit.lastFailureTime = Date.now();

        if (circuit.state === 'HALF_OPEN') {
            // Single failure in half-open goes back to open
            console.log(`[CircuitBreaker] ${name}: HALF_OPEN → OPEN (failure in half-open)`);
            circuit.state = 'OPEN';
            circuit.successes = 0;
        } else if (circuit.state === 'CLOSED') {
            if (circuit.failures >= this.config.failureThreshold) {
                console.log(`[CircuitBreaker] ${name}: CLOSED → OPEN (${circuit.failures} failures)`);
                circuit.state = 'OPEN';
            }
        }
    }

    /**
     * Get current state of a circuit
     */
    getState(name: string): CircuitState {
        return this.getCircuit(name).state;
    }

    /**
     * Force reset a circuit
     */
    reset(name: string): void {
        this.circuits.set(name, {
            failures: 0,
            successes: 0,
            lastFailureTime: 0,
            state: 'CLOSED',
        });
        console.log(`[CircuitBreaker] ${name}: Reset to CLOSED`);
    }

    /**
     * Get stats for debugging
     */
    getStats(name: string): CircuitStats | undefined {
        return this.circuits.get(name);
    }
}

// Singleton instance for Google Maps API
export const googleMapsCircuit = new CircuitBreaker({
    failureThreshold: 3,      // Open after 3 failures
    successThreshold: 2,      // Need 2 successes to close
    timeout: 60000,           // Wait 1 minute before retry
});

// Export for other external APIs
export const createCircuitBreaker = (config?: Partial<CircuitBreakerConfig>) =>
    new CircuitBreaker(config);

export default CircuitBreaker;
