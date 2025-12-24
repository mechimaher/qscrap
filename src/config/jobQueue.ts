import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from './redis';

// ============================================
// DISTRIBUTED JOB QUEUE (Bull/BullMQ)
// For reliable scheduled jobs across multiple nodes
// ============================================

interface JobQueues {
    scheduled: Queue | null;
    notifications: Queue | null;
}

const queues: JobQueues = {
    scheduled: null,
    notifications: null
};

/**
 * Initialize job queues if Redis is available
 */
export async function initializeJobQueues(): Promise<boolean> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.log('ℹ️ [Jobs] No REDIS_URL - using fallback setInterval scheduler');
        return false;
    }

    try {
        // Parse Redis URL for BullMQ connection
        const url = new URL(redisUrl);
        const connection = {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            password: url.password || undefined
        };

        // Create queues
        queues.scheduled = new Queue('scheduled-jobs', { connection });
        queues.notifications = new Queue('notifications', { connection });

        console.log('✅ [Jobs] BullMQ queues initialized');
        return true;
    } catch (err: any) {
        console.error('[Jobs] Failed to initialize queues:', err.message);
        return false;
    }
}

/**
 * Get job queue instance
 */
export function getJobQueue(name: 'scheduled' | 'notifications'): Queue | null {
    return queues[name];
}

/**
 * Schedule a recurring job
 */
export async function scheduleRecurringJob(
    queueName: 'scheduled' | 'notifications',
    jobName: string,
    data: any,
    cronExpression: string
): Promise<boolean> {
    const queue = queues[queueName];
    if (!queue) return false;

    try {
        await queue.add(jobName, data, {
            repeat: { pattern: cronExpression },
            removeOnComplete: 100,
            removeOnFail: 50
        });
        console.log(`[Jobs] Scheduled recurring job: ${jobName} (${cronExpression})`);
        return true;
    } catch (err: any) {
        console.error(`[Jobs] Failed to schedule ${jobName}:`, err.message);
        return false;
    }
}

/**
 * Add a one-time job
 */
export async function addJob(
    queueName: 'scheduled' | 'notifications',
    jobName: string,
    data: any,
    options?: { delay?: number; priority?: number }
): Promise<boolean> {
    const queue = queues[queueName];
    if (!queue) return false;

    try {
        await queue.add(jobName, data, {
            delay: options?.delay,
            priority: options?.priority,
            removeOnComplete: 100,
            removeOnFail: 50
        });
        return true;
    } catch (err: any) {
        console.error(`[Jobs] Failed to add job ${jobName}:`, err.message);
        return false;
    }
}

/**
 * Create a job worker (call this in server.ts)
 */
export function createJobWorker(
    queueName: 'scheduled' | 'notifications',
    processor: (job: Job) => Promise<void>
): Worker | null {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;

    try {
        const url = new URL(redisUrl);
        const connection = {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            password: url.password || undefined
        };

        const worker = new Worker(
            queueName === 'scheduled' ? 'scheduled-jobs' : 'notifications',
            processor,
            { connection, concurrency: 5 }
        );

        worker.on('completed', (job) => {
            console.log(`[Jobs] Completed: ${job.name}`);
        });

        worker.on('failed', (job, err) => {
            console.error(`[Jobs] Failed: ${job?.name}`, err.message);
        });

        return worker;
    } catch (err: any) {
        console.error('[Jobs] Worker creation failed:', err.message);
        return null;
    }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: 'scheduled' | 'notifications'): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
} | null> {
    const queue = queues[queueName];
    if (!queue) return null;

    try {
        const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount()
        ]);
        return { waiting, active, completed, failed };
    } catch (err) {
        return null;
    }
}

/**
 * Graceful shutdown
 */
export async function closeJobQueues(): Promise<void> {
    const closePromises = Object.values(queues)
        .filter(q => q !== null)
        .map(q => q!.close());

    await Promise.all(closePromises);
    console.log('[Jobs] All queues closed');
}
