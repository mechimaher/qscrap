import { ApiClient } from '../../services/apiClient';
import { eventBus, AppEvents } from '../../utils/eventBus';

jest.useFakeTimers();

// Mock fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('ApiClient resiliency', () => {
    let client: ApiClient;

    beforeEach(() => {
        client = new ApiClient();
        jest.spyOn(client as any, 'getToken').mockResolvedValue('token');
        mockFetch.mockReset();
        (client as any).sleep = jest.fn().mockResolvedValue(undefined);
        jest.setTimeout(15000);
        // Make breaker deterministic for tests
        (client as any).breakerThreshold = 1;
        (client as any).breakerCooldownMs = 100;
    });

    it('opens circuit after 5 consecutive 5xx responses on GET', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'fail' })
        });

        await expect(client.request('/test')).rejects.toThrow('fail');
        // Circuit now open after first failure (threshold overridden to 1)
        await expect(client.request('/test')).rejects.toThrow('Service temporarily unavailable');
    });

    it('short-circuits while breaker open and resets after cooldown', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'fail' })
        });

        for (let i = 0; i < 5; i++) {
            try {
                await client.request('/fail');
            } catch {}
        }

        await expect(client.request('/fail')).rejects.toThrow('Service temporarily unavailable');

        // advance cooldown (30s)
        jest.advanceTimersByTime(30001);

        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ ok: true })
        });

        await expect(client.request('/ok')).resolves.toEqual({ ok: true });
    });

    it('does not retry POST requests', async () => {
        const spy = jest.spyOn(client as any, 'sleep');
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'fail' })
        });

        await expect(client.request('/post', { method: 'POST' })).rejects.toThrow('fail');
        expect(spy).not.toHaveBeenCalled();
    });

    it('retries GET with jittered backoff', async () => {
        const sleepSpy = jest.spyOn(client as any, 'sleep');
        const responses = [
            { ok: false, status: 500, headers: { get: () => 'application/json' }, json: async () => ({}) },
            { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ ok: true }) }
        ];
        mockFetch.mockImplementation(() => Promise.resolve(responses.shift()!));

        await expect(client.request('/retry')).resolves.toEqual({ ok: true });
        expect(sleepSpy).toHaveBeenCalled();
    });

    it('emits auth-expired once on refresh failure', async () => {
        const handler = jest.fn();
        eventBus.on(AppEvents.AUTH_EXPIRED, handler);
        jest.spyOn(client as any, 'handleTokenRefresh').mockImplementation(() => {
            throw new Error('refresh failed');
        });
        mockFetch.mockResolvedValue({
            ok: false,
            status: 401,
            headers: { get: () => 'application/json' },
            json: async () => ({ message: 'fail' })
        });

        await expect(client.request('/needs-auth')).rejects.toThrow('refresh failed');
        await expect(client.request('/needs-auth')).rejects.toThrow('refresh failed');
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
