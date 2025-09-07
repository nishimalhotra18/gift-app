import Queue from 'bull'
import Redis from 'ioredis'
import { logger } from '../utils/logger'
import { notificationService } from './notificationService'

// Initialize Redis connection with error handling
let redis: Redis | null = null
let notificationQueue: Queue.Queue | null = null

try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  })

  // Create notification queue
  notificationQueue = new Queue('notification processing', {
    redis: {
      host: process.env.REDIS_URL?.split('://')[1]?.split(':')[0] || 'localhost',
      port: parseInt(process.env.REDIS_URL?.split(':')[2] || '6379'),
    },
  })

  // Handle Redis connection errors
  redis.on('error', (error) => {
    logger.warn('Redis connection error (queue will use fallback)', {
      error: error.message,
    })
  })

  redis.on('connect', () => {
    logger.info('Redis connected successfully')
  })

} catch (error) {
  logger.warn('Redis initialization failed (queue will use fallback)', {
    error: error instanceof Error ? error.message : String(error),
  })
}

// Queue options
const queueOptions = {
  attempts: parseInt(process.env.NOTIFICATION_RETRY_ATTEMPTS || '3'),
  backoff: {
    type: 'exponential',
    delay: parseInt(process.env.NOTIFICATION_RETRY_DELAY || '5000'),
  },
  removeOnComplete: 100,
  removeOnFail: 50,
}

export function initializeQueue() {
  if (!notificationQueue) {
    logger.warn('Queue not available (Redis not connected), notifications will be sent synchronously')
    return
  }

  // Process notification jobs
  notificationQueue.process('send-notification', async (job) => {
    const { notificationId } = job.data
    
    try {
      logger.info('Processing notification job', {
        jobId: job.id,
        notificationId,
        attempt: job.attemptsMade + 1,
      })

      await notificationService.sendNotification(notificationId)
      
      logger.info('Notification job completed successfully', {
        jobId: job.id,
        notificationId,
      })
    } catch (error) {
      logger.error('Notification job failed', {
        jobId: job.id,
        notificationId,
        error: error instanceof Error ? error.message : String(error),
        attempt: job.attemptsMade + 1,
      })
      throw error
    }
  })

  // Process coupon created notifications
  notificationQueue.process('coupon-created-notifications', async (job) => {
    const { couponId } = job.data
    
    try {
      logger.info('Processing coupon created notifications', {
        jobId: job.id,
        couponId,
        attempt: job.attemptsMade + 1,
      })

      await notificationService.sendCouponCreatedNotifications(couponId)
      
      logger.info('Coupon created notifications completed', {
        jobId: job.id,
        couponId,
      })
    } catch (error) {
      logger.error('Coupon created notifications failed', {
        jobId: job.id,
        couponId,
        error: error instanceof Error ? error.message : String(error),
        attempt: job.attemptsMade + 1,
      })
      throw error
    }
  })

  // Process coupon claimed notification
  notificationQueue.process('coupon-claimed-notification', async (job) => {
    const { couponId } = job.data
    
    try {
      logger.info('Processing coupon claimed notification', {
        jobId: job.id,
        couponId,
        attempt: job.attemptsMade + 1,
      })

      await notificationService.sendCouponClaimedNotification(couponId)
      
      logger.info('Coupon claimed notification completed', {
        jobId: job.id,
        couponId,
      })
    } catch (error) {
      logger.error('Coupon claimed notification failed', {
        jobId: job.id,
        couponId,
        error: error instanceof Error ? error.message : String(error),
        attempt: job.attemptsMade + 1,
      })
      throw error
    }
  })

  // Process coupon redeemed notification
  notificationQueue.process('coupon-redeemed-notification', async (job) => {
    const { couponId, redemptionAmount } = job.data
    
    try {
      logger.info('Processing coupon redeemed notification', {
        jobId: job.id,
        couponId,
        redemptionAmount,
        attempt: job.attemptsMade + 1,
      })

      await notificationService.sendCouponRedeemedNotification(couponId, redemptionAmount)
      
      logger.info('Coupon redeemed notification completed', {
        jobId: job.id,
        couponId,
        redemptionAmount,
      })
    } catch (error) {
      logger.error('Coupon redeemed notification failed', {
        jobId: job.id,
        couponId,
        redemptionAmount,
        error: error instanceof Error ? error.message : String(error),
        attempt: job.attemptsMade + 1,
      })
      throw error
    }
  })

  // Queue event handlers
  notificationQueue.on('completed', (job) => {
    logger.info('Queue job completed', {
      jobId: job.id,
      jobName: job.name,
      duration: Date.now() - job.timestamp,
    })
  })

  notificationQueue.on('failed', (job, err) => {
    logger.error('Queue job failed', {
      jobId: job.id,
      jobName: job.name,
      error: err.message,
      attempts: job.attemptsMade,
    })
  })

  notificationQueue.on('stalled', (job) => {
    logger.warn('Queue job stalled', {
      jobId: job.id,
      jobName: job.name,
    })
  })

  logger.info('Notification queue initialized')
}

// Helper functions to add jobs to queue
export async function addNotificationJob(notificationId: string) {
  if (!notificationQueue) {
    logger.warn('Queue not available, sending notification synchronously', { notificationId })
    try {
      await notificationService.sendNotification(notificationId)
    } catch (error) {
      logger.error('Synchronous notification failed', {
        notificationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return null
  }
  return notificationQueue.add('send-notification', { notificationId }, queueOptions)
}

export async function addCouponCreatedNotificationsJob(couponId: string) {
  if (!notificationQueue) {
    logger.warn('Queue not available, sending coupon created notifications synchronously', { couponId })
    try {
      await notificationService.sendCouponCreatedNotifications(couponId)
    } catch (error) {
      logger.error('Synchronous coupon created notifications failed', {
        couponId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return null
  }
  return notificationQueue.add('coupon-created-notifications', { couponId }, queueOptions)
}

export async function addCouponClaimedNotificationJob(couponId: string) {
  if (!notificationQueue) {
    logger.warn('Queue not available, sending coupon claimed notification synchronously', { couponId })
    try {
      await notificationService.sendCouponClaimedNotification(couponId)
    } catch (error) {
      logger.error('Synchronous coupon claimed notification failed', {
        couponId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return null
  }
  return notificationQueue.add('coupon-claimed-notification', { couponId }, queueOptions)
}

export async function addCouponRedeemedNotificationJob(couponId: string, redemptionAmount: number) {
  if (!notificationQueue) {
    logger.warn('Queue not available, sending coupon redeemed notification synchronously', { couponId, redemptionAmount })
    try {
      await notificationService.sendCouponRedeemedNotification(couponId, redemptionAmount)
    } catch (error) {
      logger.error('Synchronous coupon redeemed notification failed', {
        couponId,
        redemptionAmount,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return null
  }
  return notificationQueue.add('coupon-redeemed-notification', { couponId, redemptionAmount }, queueOptions)
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down notification queue...')
  if (notificationQueue) {
    await notificationQueue.close()
  }
  if (redis) {
    await redis.quit()
  }
})

process.on('SIGINT', async () => {
  logger.info('Shutting down notification queue...')
  if (notificationQueue) {
    await notificationQueue.close()
  }
  if (redis) {
    await redis.quit()
  }
})
