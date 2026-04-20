"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeJobQueues = initializeJobQueues;
exports.getJobQueue = getJobQueue;
exports.scheduleRecurringJob = scheduleRecurringJob;
exports.addJob = addJob;
exports.createJobWorker = createJobWorker;
exports.getQueueStats = getQueueStats;
exports.closeJobQueues = closeJobQueues;
const bullmq_1 = require("bullmq");
const queues = {
    scheduled: null,
    notifications: null
};
/**
 * Initialize job queues if Redis is available
 */
async function initializeJobQueues() {
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
        queues.scheduled = new bullmq_1.Queue('scheduled-jobs', { connection });
        queues.notifications = new bullmq_1.Queue('notifications', { connection });
        console.log('✅ [Jobs] BullMQ queues initialized');
        return true;
    }
    catch (err) {
        console.error('[Jobs] Failed to initialize queues:', err.message);
        return false;
    }
}
/**
 * Get job queue instance
 */
function getJobQueue(name) {
    return queues[name];
}
/**
 * Schedule a recurring job
 */
async function scheduleRecurringJob(queueName, jobName, data, cronExpression) {
    const queue = queues[queueName];
    if (!queue)
        return false;
    try {
        await queue.add(jobName, data, {
            repeat: { pattern: cronExpression },
            removeOnComplete: 100,
            removeOnFail: 50
        });
        console.log(`[Jobs] Scheduled recurring job: ${jobName} (${cronExpression})`);
        return true;
    }
    catch (err) {
        console.error(`[Jobs] Failed to schedule ${jobName}:`, err.message);
        return false;
    }
}
/**
 * Add a one-time job
 */
async function addJob(queueName, jobName, data, options) {
    const queue = queues[queueName];
    if (!queue)
        return false;
    try {
        await queue.add(jobName, data, {
            delay: options?.delay,
            priority: options?.priority,
            removeOnComplete: 100,
            removeOnFail: 50
        });
        return true;
    }
    catch (err) {
        console.error(`[Jobs] Failed to add job ${jobName}:`, err.message);
        return false;
    }
}
/**
 * Create a job worker (call this in server.ts)
 */
function createJobWorker(queueName, processor) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl)
        return null;
    try {
        const url = new URL(redisUrl);
        const connection = {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            password: url.password || undefined
        };
        const worker = new bullmq_1.Worker(queueName === 'scheduled' ? 'scheduled-jobs' : 'notifications', processor, { connection, concurrency: 5 });
        worker.on('completed', (job) => {
            console.log(`[Jobs] Completed: ${job.name}`);
        });
        worker.on('failed', (job, err) => {
            console.error(`[Jobs] Failed: ${job?.name}`, err.message);
        });
        return worker;
    }
    catch (err) {
        console.error('[Jobs] Worker creation failed:', err.message);
        return null;
    }
}
/**
 * Get queue statistics
 */
async function getQueueStats(queueName) {
    const queue = queues[queueName];
    if (!queue)
        return null;
    try {
        const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount()
        ]);
        return { waiting, active, completed, failed };
    }
    catch (err) {
        return null;
    }
}
/**
 * Graceful shutdown
 */
async function closeJobQueues() {
    const closePromises = Object.values(queues)
        .filter(q => q !== null)
        .map(q => q.close());
    await Promise.all(closePromises);
    console.log('[Jobs] All queues closed');
}
