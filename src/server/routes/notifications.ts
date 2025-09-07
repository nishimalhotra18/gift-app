import { Router, Request, Response } from 'express'
import { param, query, validationResult } from 'express-validator'
import { prisma } from '../index'
import { notificationService } from '../services/notificationService'
import { logger } from '../utils/logger'

const router = Router()

// Validation middleware
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    })
  }
  next()
}

// Get notifications for a user
router.get('/user/:userId', [
  param('userId').isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        coupon: {
          select: {
            id: true,
            code: true,
            title: true,
            amount: true,
            balance: true,
          },
        },
      },
    })

    const total = await prisma.notification.count({
      where: { userId },
    })

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to get user notifications', {
        error: error instanceof Error ? error.message : String(error),
      userId: req.params.userId,
    })

    res.status(500).json({
      error: 'Failed to get notifications',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get notification by ID
router.get('/:id', [
  param('id').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        coupon: {
          select: {
            id: true,
            code: true,
            title: true,
            amount: true,
            balance: true,
          },
        },
      },
    })

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Invalid notification ID',
      })
    }

    res.json({
      success: true,
      data: { notification },
    })
  } catch (error) {
    logger.error('Failed to get notification', {
        error: error instanceof Error ? error.message : String(error),
      id: req.params.id,
    })

    res.status(500).json({
      error: 'Failed to get notification',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Retry failed notification
router.post('/:id/retry', [
  param('id').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const notification = await prisma.notification.findUnique({
      where: { id },
    })

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Invalid notification ID',
      })
    }

    if (notification.status !== 'FAILED') {
      return res.status(400).json({
        error: 'Invalid notification status',
        message: 'Only failed notifications can be retried',
      })
    }

    // Reset notification status and retry
    await prisma.notification.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorMessage: null,
        retryCount: { increment: 1 },
      },
    })

    // Send notification
    await notificationService.sendNotification(id)

    logger.info('Notification retry initiated', {
      notificationId: id,
      channel: notification.channel,
      recipient: notification.recipient,
    })

    res.json({
      success: true,
      message: 'Notification retry initiated',
    })
  } catch (error) {
    logger.error('Failed to retry notification', {
        error: error instanceof Error ? error.message : String(error),
      id: req.params.id,
    })

    res.status(500).json({
      error: 'Failed to retry notification',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get notification statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await prisma.notification.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    })

    const channelStats = await prisma.notification.groupBy({
      by: ['channel'],
      _count: {
        id: true,
      },
    })

    const typeStats = await prisma.notification.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
    })

    const totalNotifications = await prisma.notification.count()
    const failedNotifications = await prisma.notification.count({
      where: { status: 'FAILED' },
    })

    res.json({
      success: true,
      data: {
        overview: {
          total: totalNotifications,
          failed: failedNotifications,
          successRate: totalNotifications > 0 ? ((totalNotifications - failedNotifications) / totalNotifications * 100).toFixed(2) : '0',
        },
        statusBreakdown: stats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.id
          return acc
        }, {} as any),
        channelBreakdown: channelStats.reduce((acc, stat) => {
          acc[stat.channel] = stat._count.id
          return acc
        }, {} as any),
        typeBreakdown: typeStats.reduce((acc, stat) => {
          acc[stat.type] = stat._count.id
          return acc
        }, {} as any),
      },
    })
  } catch (error) {
    logger.error('Failed to get notification statistics', {
        error: error instanceof Error ? error.message : String(error),
    })

    res.status(500).json({
      error: 'Failed to get notification statistics',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
