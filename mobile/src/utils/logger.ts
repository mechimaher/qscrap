// QScrap Customer App - Production Logger
// Wraps console methods to disable in production builds
// Play Store compliant: No sensitive data logged in release builds

const isDev = __DEV__;

/**
 * Development-only logger - silenced in production
 */
export const log = isDev
    ? console.log.bind(console)
    : () => { };

export const warn = isDev
    ? console.warn.bind(console)
    : () => { };

export const error = console.error.bind(console); // Keep errors for crash reporting

export const info = isDev
    ? console.info.bind(console)
    : () => { };

/**
 * Tagged logger for specific modules
 */
export const createLogger = (tag: string) => ({
    log: (...args: any[]) => log(`[${tag}]`, ...args),
    warn: (...args: any[]) => warn(`[${tag}]`, ...args),
    error: (...args: any[]) => error(`[${tag}]`, ...args),
    info: (...args: any[]) => info(`[${tag}]`, ...args),
});

export default { log, warn, error, info, createLogger };
