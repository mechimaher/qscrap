import { Request, Response } from 'express';
import { strictValidateOrigin, validateOrigin } from '../csrf.middleware';

type MockResponse = Response & {
    status: jest.Mock;
    json: jest.Mock;
};

const createMockResponse = (): MockResponse => {
    const res = {} as MockResponse;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const createRequest = (overrides: Partial<Request> = {}): Request => {
    const base: Partial<Request> = {
        method: 'POST',
        headers: {}
    };
    return { ...base, ...overrides } as Request;
};

describe('CSRF origin middleware', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        if (typeof originalAllowedOrigins === 'undefined') {
            delete process.env.ALLOWED_ORIGINS;
        } else {
            process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
        }
        jest.clearAllMocks();
    });

    it('blocks prefix-origin bypasses in production', () => {
        process.env.NODE_ENV = 'production';
        const req = createRequest({
            headers: {
                origin: 'https://qscrap.qa.attacker.com'
            }
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateOrigin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('allows exact allowed origin in production', () => {
        process.env.NODE_ENV = 'production';
        const req = createRequest({
            headers: {
                origin: 'https://qscrap.qa'
            }
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateOrigin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('skips origin validation for authenticated bearer requests', () => {
        process.env.NODE_ENV = 'production';
        const req = createRequest({
            headers: {
                origin: 'https://evil.example',
                authorization: 'Bearer token'
            }
        });
        const res = createMockResponse();
        const next = jest.fn();

        validateOrigin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('strict mode requires origin/referer on state-changing requests', () => {
        process.env.NODE_ENV = 'production';
        const req = createRequest({
            headers: {}
        });
        const res = createMockResponse();
        const next = jest.fn();

        strictValidateOrigin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('strict mode blocks malicious referer prefixes', () => {
        process.env.NODE_ENV = 'production';
        const req = createRequest({
            headers: {
                referer: 'https://qscrap.qa.attacker.com/steal'
            }
        });
        const res = createMockResponse();
        const next = jest.fn();

        strictValidateOrigin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
