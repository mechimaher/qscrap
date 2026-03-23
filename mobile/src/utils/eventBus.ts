type Listener = (...args: any[]) => void;

// Lightweight event bus for app-wide events (no external deps)
class EventBus {
    private listeners: Record<string, Set<Listener>> = {};

    on(event: string, listener: Listener): () => void {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set();
        }
        this.listeners[event].add(listener);
        return () => this.off(event, listener);
    }

    off(event: string, listener: Listener) {
        this.listeners[event]?.delete(listener);
    }

    emit(event: string, ...args: any[]) {
        this.listeners[event]?.forEach((listener) => {
            try {
                listener(...args);
            } catch (err) {
                // Swallow to avoid cascading failures
            }
        });
    }
}

export const eventBus = new EventBus();

export const AppEvents = {
    AUTH_EXPIRED: 'auth-expired'
} as const;

export type AppEventKey = typeof AppEvents[keyof typeof AppEvents];
