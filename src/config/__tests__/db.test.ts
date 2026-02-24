const createdPools: Array<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    on: jest.Mock;
    end: jest.Mock;
    __handlers: Record<string, (...args: any[]) => void>;
}> = [];

const loggerMock = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    db: jest.fn(),
    startup: jest.fn(),
    shutdown: jest.fn()
};

jest.mock('pg', () => {
    const Pool = jest.fn().mockImplementation(() => {
        const handlers: Record<string, (...args: any[]) => void> = {};
        const pool = {
            totalCount: 10,
            idleCount: 4,
            waitingCount: 1,
            on: jest.fn((event: string, handler: (...args: any[]) => void) => {
                handlers[event] = handler;
            }),
            end: jest.fn().mockResolvedValue(undefined),
            __handlers: handlers
        };

        createdPools.push(pool);
        return pool;
    });

    return { Pool };
});

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: loggerMock
}));

const loadDbModule = async () => {
    jest.resetModules();
    createdPools.length = 0;
    delete process.env.DB_READ_REPLICA_HOST;

    const dbModule = await import('../db');
    const primaryPool = createdPools[0];

    return {
        dbModule,
        primaryPool,
        errorHandler: primaryPool.__handlers.error,
        connectHandler: primaryPool.__handlers.connect
    };
};

describe('DB Circuit Breaker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('increments consecutive errors when pool emits error', async () => {
        const { dbModule, errorHandler } = await loadDbModule();

        expect(dbModule.getPoolHealth().consecutiveErrors).toBe(0);

        errorHandler(new Error('db failure #1'));

        const health = dbModule.getPoolHealth();
        expect(health.consecutiveErrors).toBe(1);
        expect(health.healthy).toBe(true);
        expect(loggerMock.error).toHaveBeenCalledWith(
            'Database pool error',
            expect.objectContaining({
                consecutiveErrors: 1
            })
        );
    });

    it('resets consecutive errors on successful pool connect', async () => {
        const { dbModule, errorHandler, connectHandler } = await loadDbModule();

        errorHandler(new Error('db failure #1'));
        errorHandler(new Error('db failure #2'));
        expect(dbModule.getPoolHealth().consecutiveErrors).toBe(2);

        connectHandler();

        const health = dbModule.getPoolHealth();
        expect(health.consecutiveErrors).toBe(0);
        expect(health.healthy).toBe(true);
        expect(loggerMock.db).toHaveBeenCalledWith('Client connected to pool');
    });

    it('reports unhealthy after max consecutive error threshold', async () => {
        const { dbModule, errorHandler } = await loadDbModule();

        for (let index = 0; index < 5; index++) {
            errorHandler(new Error(`db failure #${index + 1}`));
        }

        const health = dbModule.getPoolHealth();
        expect(health.consecutiveErrors).toBe(5);
        expect(health.healthy).toBe(false);
    });

    it('logs structured circuit breaker alert at threshold', async () => {
        const { errorHandler } = await loadDbModule();

        errorHandler(new Error('db failure #1'));
        errorHandler(new Error('db failure #2'));
        errorHandler(new Error('db failure #3'));

        expect(loggerMock.error).toHaveBeenCalledWith(
            'CIRCUIT_BREAKER: Database error threshold reached',
            expect.objectContaining({
                consecutiveErrors: 3,
                threshold: 3
            })
        );
    });
});
