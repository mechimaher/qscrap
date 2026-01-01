/**
 * QScrap Structured Logger
 * 
 * Production-ready logging with log levels and structured output.
 * Replaces console.log throughout the codebase.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: unknown;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    nodeId: string;
    context?: LogContext;
}

class Logger {
    private nodeId: string;
    private minLevel: LogLevel;
    private levelOrder: Record<LogLevel, number> = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };

    constructor() {
        this.nodeId = process.env.NODE_ID || `node-${process.pid}`;
        this.minLevel = (process.env.LOG_LEVEL as LogLevel) ||
            (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levelOrder[level] >= this.levelOrder[this.minLevel];
    }

    private formatEntry(entry: LogEntry): string {
        if (process.env.LOG_FORMAT === 'json') {
            return JSON.stringify(entry);
        }

        // Human-readable format for development
        const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.nodeId}]`;
        const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
        return `${prefix} ${entry.message}${context}`;
    }

    private log(level: LogLevel, message: string, context?: LogContext): void {
        if (!this.shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            nodeId: this.nodeId,
            context
        };

        const formatted = this.formatEntry(entry);

        switch (level) {
            case 'error':
                console.error(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            default:
                console.log(formatted);
        }
    }

    debug(message: string, context?: LogContext): void {
        this.log('debug', message, context);
    }

    info(message: string, context?: LogContext): void {
        this.log('info', message, context);
    }

    warn(message: string, context?: LogContext): void {
        this.log('warn', message, context);
    }

    error(message: string, context?: LogContext): void {
        this.log('error', message, context);
    }

    // Convenience methods for common patterns
    startup(component: string, details?: LogContext): void {
        this.info(`✅ ${component} initialized`, details);
    }

    shutdown(component: string): void {
        this.info(`${component} shutting down`);
    }

    jobStart(jobName: string): void {
        this.info(`[CRON] Starting ${jobName}`);
    }

    jobComplete(jobName: string, result?: LogContext): void {
        this.info(`[CRON] Completed ${jobName}`, result);
    }

    socket(event: string, details?: LogContext): void {
        this.debug(`[SOCKET] ${event}`, details);
    }

    db(event: string, details?: LogContext): void {
        this.debug(`[DB] ${event}`, details);
    }
}

// Singleton instance
export const logger = new Logger();

// Default export for easy importing
export default logger;
