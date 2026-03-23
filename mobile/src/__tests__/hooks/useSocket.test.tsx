import { renderHook, act } from '@testing-library/react-native';
import { useSocket } from '../../hooks/useSocket';

jest.mock('socket.io-client', () => {
    const listeners: Record<string, any[]> = {};
    const socketMock: any = {
        on: (event: string, cb: any) => {
            listeners[event] = listeners[event] || [];
            listeners[event].push(cb);
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
        connected: false
    };
    const trigger = (event: string, payload?: any) => {
        (listeners[event] || []).forEach((cb) => cb(payload));
    };
    return {
        io: () => socketMock,
        __mock: { socketMock, trigger }
    };
});

jest.mock('../../services/api', () => ({
    api: {
        getToken: jest.fn().mockResolvedValue('token')
    }
}));

describe('useSocket backoff', () => {
    const socketModule = require('socket.io-client');
    const { trigger, socketMock } = socketModule.__mock;

    beforeEach(() => {
        socketMock.connected = false;
        socketMock.disconnect.mockClear();
        socketMock.emit.mockClear();
    });

    it('marks degraded after repeated failures and recovers on connect', async () => {
        const { result } = renderHook(() => useSocket());

        // trigger consecutive connect_error events
        act(() => {
            trigger('connect_error', new Error('fail1'));
            trigger('connect_error', new Error('fail2'));
            trigger('connect_error', new Error('fail3'));
            trigger('connect_error', new Error('fail4'));
            trigger('connect_error', new Error('fail5'));
            trigger('connect_error', new Error('fail6'));
        });

        expect(result.current.isRealtimeDegraded).toBe(true);
        expect(result.current.lastError).toBe('fail6');

        // simulate successful connect
        act(() => {
            socketMock.connected = true;
            trigger('connect');
        });

        expect(result.current.isRealtimeDegraded).toBe(false);
        expect(result.current.lastError).toBeNull();
    });
});
