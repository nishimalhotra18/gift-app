import { Router, Request, Response } from 'express'
import { query, validationResult } from 'express-validator'
import { prisma } from '../index'
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

// Get dashboard overview
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalCoupons,
      activeCoupons,
      redeemedCoupons,
      totalUsers,
      totalRedemptions,
      totalRevenue,
      recentCoupons,
      recentRedemptions,
      failedNotifications,
    ] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.count({ where: { status: 'ACTIVE' } }),
      prisma.coupon.count({ where: { status: 'REDEEMED' } }),
      prisma.user.count(),
      prisma.redemption.count(),
      prisma.redemption.aggregate({
        _sum: { amount: true },
      }),
      prisma.coupon.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { email: true, firstName: true, lastName: true } },
          recipient: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      prisma.redemption.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          coupon: {
            select: {
              code: true,
              title: true,
              sender: { select: { email: true, firstName: true, lastName: true } },
              recipient: { select: { email: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.notification.count({ where: { status: 'FAILED' } }),
    ])

    res.json({
      success: true,
      data: {
        overview: {
          totalCoupons,
          activeCoupons,
          redeemedCoupons,
          totalUsers,
          totalRedemptions,
          totalRevenue: totalRevenue._sum.amount || 0,
          failedNotifications,
        },
        recentCoupons,
        recentRedemptions,
      },
    })
  } catch (error) {
    logger.error('Failed to get dashboard data', {
        error: error instanceof Error ? error.message : String(error),
    })

    res.status(500).json({
      error: 'Failed to get dashboard data',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get coupons with pagination and filters
router.get('/coupons', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PENDING', 'ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED']),
  query('search').optional().isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const status = req.query.status as string
    const search = req.query.search as string

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { recipientEmail: { contains: search, mode: 'insensitive' } },
        { sender: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { email: true, firstName: true, lastName: true } },
          recipient: { select: { email: true, firstName: true, lastName: true } },
          redemptions: {
            select: {
              id: true,
              amount: true,
              merchantName: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.coupon.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        coupons,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to get coupons', {
        error: error instanceof Error ? error.message : String(error),
      query: req.query,
    })

    res.status(500).json({
      error: 'Failed to get coupons',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get users with pagination
router.get('/users', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = req.query.search as string

    const where: any = {}

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              sentCoupons: true,
              receivedCoupons: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to get users', {
        error: error instanceof Error ? error.message : String(error),
      query: req.query,
    })

    res.status(500).json({
      error: 'Failed to get users',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get payment intents with pagination
router.get('/payments', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED']),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const status = req.query.status as string

    const where: any = {}

    if (status) {
      where.status = status
    }

    const [payments, total] = await Promise.all([
      prisma.paymentIntent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentIntent.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to get payments', {
        error: error instanceof Error ? error.message : String(error),
      query: req.query,
    })

    res.status(500).json({
      error: 'Failed to get payments',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get notifications with pagination
router.get('/notifications', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED']),
  query('channel').optional().isIn(['EMAIL', 'SMS', 'PUSH']),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const status = req.query.status as string
    const channel = req.query.channel as string

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (channel) {
      where.channel = channel
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          coupon: { select: { code: true, title: true } },
        },
      }),
      prisma.notification.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to get notifications', {
        error: error instanceof Error ? error.message : String(error),
      query: req.query,
    })

    res.status(500).json({
      error: 'Failed to get notifications',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Retry all failed notifications
router.post('/notifications/retry-failed', async (req, res) => {
  try {
    const failedNotifications = await prisma.notification.findMany({
      where: { status: 'FAILED' },
      take: 100, // Limit to prevent overwhelming the system
    })

    const retryPromises = failedNotifications.map(async (notification) => {
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'PENDING',
          errorMessage: null,
          retryCount: { increment: 1 },
        },
      })
    })

    await Promise.all(retryPromises)

    logger.info('Retry initiated for failed notifications', {
      count: failedNotifications.length,
    })

    res.json({
      success: true,
      message: `Retry initiated for ${failedNotifications.length} failed notifications`,
      count: failedNotifications.length,
    })
  } catch (error) {
    logger.error('Failed to retry failed notifications', {
        error: error instanceof Error ? error.message : String(error),
    })

    res.status(500).json({
      error: 'Failed to retry failed notifications',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
