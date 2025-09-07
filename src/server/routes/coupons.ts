import { Router, Request, Response } from 'express'
import { body, param, query, validationResult } from 'express-validator'
import { prisma } from '../index'
import { stripeService } from '../services/stripeService'
import { walletService } from '../services/walletService'
import { addCouponCreatedNotificationsJob, addCouponClaimedNotificationJob, addCouponRedeemedNotificationJob } from '../services/queueService'
import { logger } from '../utils/logger'
import { CouponStatus } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

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

// Generate unique coupon code
function generateCouponCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Create a new coupon
router.post('/', [
  body('amount').isInt({ min: 2500 }).withMessage('Amount must be at least $25.00'),
  body('recipientEmail').isEmail().normalizeEmail(),
  body('recipientPhone').optional().isMobilePhone('en-US'),
  body('title').isString().trim().isLength({ min: 1, max: 255 }),
  body('message').optional().isString().trim().isLength({ max: 500 }),
  body('senderEmail').isEmail().normalizeEmail(),
  body('senderName').optional().isString().trim().isLength({ max: 255 }),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      amount,
      recipientEmail,
      recipientPhone,
      title,
      message,
      senderEmail,
      senderName,
    } = req.body

    // Create or find sender user
    let sender = await prisma.user.findUnique({
      where: { email: senderEmail },
    })

    if (!sender) {
      sender = await prisma.user.create({
        data: {
          email: senderEmail,
          firstName: senderName?.split(' ')[0],
          lastName: senderName?.split(' ').slice(1).join(' '),
        },
      })
    }

    // Generate unique coupon code
    let couponCode: string
    let isUnique = false
    let attempts = 0
    
    do {
      couponCode = generateCouponCode()
      const existing = await prisma.coupon.findUnique({
        where: { code: couponCode },
      })
      isUnique = !existing
      attempts++
    } while (!isUnique && attempts < 10)

    if (!isUnique) {
      throw new Error('Failed to generate unique coupon code')
    }

    // Create coupon
    const coupon = await prisma.coupon.create({
      data: {
        code: couponCode,
        amount: amount,
        balance: amount,
        currency: 'USD',
        status: CouponStatus.PENDING,
        title,
        message,
        senderId: sender.id,
        recipientEmail,
        recipientPhone,
      },
      include: {
        sender: true,
      },
    })

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent(
      amount / 100, // Convert from cents to dollars
      'USD',
      {
        couponId: coupon.id,
        couponCode: coupon.code,
        senderEmail: sender.email,
        recipientEmail: coupon.recipientEmail,
      }
    )

    // Store payment intent
    await prisma.paymentIntent.create({
      data: {
        stripePaymentIntentId: paymentIntent.id,
        couponId: coupon.id,
        amount: amount,
        currency: 'USD',
        status: 'PENDING',
        metadata: paymentIntent.metadata,
      },
    })

    logger.info('Coupon created successfully', {
      couponId: coupon.id,
      couponCode: coupon.code,
      amount: coupon.amount,
      senderEmail: sender.email,
      recipientEmail: coupon.recipientEmail,
      paymentIntentId: paymentIntent.id,
    })

    res.status(201).json({
      success: true,
      data: {
        coupon: {
          id: coupon.id,
          code: coupon.code,
          amount: coupon.amount,
          balance: coupon.balance,
          currency: coupon.currency,
          status: coupon.status,
          title: coupon.title,
          message: coupon.message,
          recipientEmail: coupon.recipientEmail,
          recipientPhone: coupon.recipientPhone,
          sender: {
            email: sender.email,
            firstName: sender.firstName,
            lastName: sender.lastName,
          },
          createdAt: coupon.createdAt,
        },
        paymentIntent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to create coupon', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body,
    })

    res.status(500).json({
      error: 'Failed to create coupon',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get coupon by code (for claiming)
router.get('/claim/:code', [
  param('code').isString().isLength({ min: 8, max: 8 }),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { code } = req.params

    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        sender: true,
        recipient: true,
      },
    })

    if (!coupon) {
      return res.status(404).json({
        error: 'Coupon not found',
        message: 'Invalid coupon code',
      })
    }

    if (coupon.status === CouponStatus.EXPIRED) {
      return res.status(410).json({
        error: 'Coupon expired',
        message: 'This coupon has expired',
      })
    }

    if (coupon.status === CouponStatus.CANCELLED) {
      return res.status(410).json({
        error: 'Coupon cancelled',
        message: 'This coupon has been cancelled',
      })
    }

    res.json({
      success: true,
      data: {
        coupon: {
          id: coupon.id,
          code: coupon.code,
          amount: coupon.amount,
          balance: coupon.balance,
          currency: coupon.currency,
          status: coupon.status,
          title: coupon.title,
          message: coupon.message,
          recipientEmail: coupon.recipientEmail,
          recipientPhone: coupon.recipientPhone,
          sender: {
            email: coupon.sender.email,
            firstName: coupon.sender.firstName,
            lastName: coupon.sender.lastName,
          },
          recipient: coupon.recipient ? {
            email: coupon.recipient.email,
            firstName: coupon.recipient.firstName,
            lastName: coupon.recipient.lastName,
          } : null,
          expiresAt: coupon.expiresAt,
          claimedAt: coupon.claimedAt,
          createdAt: coupon.createdAt,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to get coupon for claiming', {
      error: error instanceof Error ? error.message : String(error),
      code: req.params.code,
    })

    res.status(500).json({
      error: 'Failed to get coupon',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Claim coupon
router.post('/claim/:code', [
  param('code').isString().isLength({ min: 8, max: 8 }),
  body('recipientEmail').isEmail().normalizeEmail(),
  body('recipientName').optional().isString().trim().isLength({ max: 255 }),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const { recipientEmail, recipientName } = req.body

    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: { sender: true },
    })

    if (!coupon) {
      return res.status(404).json({
        error: 'Coupon not found',
        message: 'Invalid coupon code',
      })
    }

    if (coupon.status !== CouponStatus.PENDING) {
      return res.status(400).json({
        error: 'Coupon already claimed',
        message: 'This coupon has already been claimed',
      })
    }

    if (coupon.recipientEmail !== recipientEmail) {
      return res.status(403).json({
        error: 'Invalid recipient',
        message: 'This coupon is not for the provided email address',
      })
    }

    // Create or find recipient user
    let recipient = await prisma.user.findUnique({
      where: { email: recipientEmail },
    })

    if (!recipient) {
      recipient = await prisma.user.create({
        data: {
          email: recipientEmail,
          firstName: recipientName?.split(' ')[0],
          lastName: recipientName?.split(' ').slice(1).join(' '),
        },
      })
    }

    // Update coupon status
    const updatedCoupon = await prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        status: CouponStatus.ACTIVE,
        recipientId: recipient.id,
        claimedAt: new Date(),
      },
      include: {
        sender: true,
        recipient: true,
      },
    })

    // Generate wallet passes
    const walletPasses = await walletService.getWalletPasses(coupon.id)

    // Queue notification to sender
    await addCouponClaimedNotificationJob(coupon.id)

    logger.info('Coupon claimed successfully', {
      couponId: coupon.id,
      couponCode: coupon.code,
      recipientEmail: recipient.email,
      senderEmail: coupon.sender.email,
    })

    res.json({
      success: true,
      data: {
        coupon: {
          id: updatedCoupon.id,
          code: updatedCoupon.code,
          amount: updatedCoupon.amount,
          balance: updatedCoupon.balance,
          currency: updatedCoupon.currency,
          status: updatedCoupon.status,
          title: updatedCoupon.title,
          message: updatedCoupon.message,
          recipientEmail: updatedCoupon.recipientEmail,
          recipientPhone: updatedCoupon.recipientPhone,
          sender: {
            email: updatedCoupon.sender.email,
            firstName: updatedCoupon.sender.firstName,
            lastName: updatedCoupon.sender.lastName,
          },
          recipient: updatedCoupon.recipient ? {
            email: updatedCoupon.recipient.email,
            firstName: updatedCoupon.recipient.firstName,
            lastName: updatedCoupon.recipient.lastName,
          } : null,
          expiresAt: updatedCoupon.expiresAt,
          claimedAt: updatedCoupon.claimedAt,
          createdAt: updatedCoupon.createdAt,
        },
        walletPasses,
      },
    })
  } catch (error) {
    logger.error('Failed to claim coupon', {
      error: error instanceof Error ? error.message : String(error),
      code: req.params.code,
      body: req.body,
    })

    res.status(500).json({
      error: 'Failed to claim coupon',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Redeem coupon (partial or full)
router.post('/redeem/:code', [
  param('code').isString().isLength({ min: 8, max: 8 }),
  body('amount').isInt({ min: 1 }).withMessage('Amount must be at least 1 cent'),
  body('merchantName').optional().isString().trim().isLength({ max: 255 }),
  body('merchantId').optional().isString().trim().isLength({ max: 255 }),
  body('transactionId').optional().isString().trim().isLength({ max: 255 }),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { code } = req.params
    const { amount, merchantName, merchantId, transactionId } = req.body

    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: { recipient: true },
    })

    if (!coupon) {
      return res.status(404).json({
        error: 'Coupon not found',
        message: 'Invalid coupon code',
      })
    }

    if (coupon.status !== CouponStatus.ACTIVE) {
      return res.status(400).json({
        error: 'Coupon not active',
        message: 'This coupon is not active for redemption',
      })
    }

    if (amount > coupon.balance) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: `Coupon balance is $${(coupon.balance / 100).toFixed(2)}, requested $${(amount / 100).toFixed(2)}`,
      })
    }

    // Create redemption record
    const redemption = await prisma.redemption.create({
      data: {
        couponId: coupon.id,
        amount: amount,
        merchantName,
        merchantId,
        transactionId,
        status: 'APPROVED',
      },
    })

    // Update coupon balance
    const newBalance = coupon.balance - amount
    const newStatus = newBalance === 0 ? CouponStatus.REDEEMED : CouponStatus.ACTIVE

    const updatedCoupon = await prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        balance: newBalance,
        status: newStatus,
      },
      include: {
        sender: true,
        recipient: true,
      },
    })

    // Queue notification to recipient
    await addCouponRedeemedNotificationJob(coupon.id, amount)

    logger.info('Coupon redeemed successfully', {
      couponId: coupon.id,
      couponCode: coupon.code,
      redemptionAmount: amount,
      newBalance: newBalance,
      merchantName,
      transactionId,
    })

    res.json({
      success: true,
      data: {
        redemption: {
          id: redemption.id,
          amount: redemption.amount,
          merchantName: redemption.merchantName,
          merchantId: redemption.merchantId,
          transactionId: redemption.transactionId,
          status: redemption.status,
          createdAt: redemption.createdAt,
        },
        coupon: {
          id: updatedCoupon.id,
          code: updatedCoupon.code,
          amount: updatedCoupon.amount,
          balance: updatedCoupon.balance,
          currency: updatedCoupon.currency,
          status: updatedCoupon.status,
          title: updatedCoupon.title,
          message: updatedCoupon.message,
          recipientEmail: updatedCoupon.recipientEmail,
          recipientPhone: updatedCoupon.recipientPhone,
          sender: {
            email: updatedCoupon.sender.email,
            firstName: updatedCoupon.sender.firstName,
            lastName: updatedCoupon.sender.lastName,
          },
          recipient: updatedCoupon.recipient ? {
            email: updatedCoupon.recipient.email,
            firstName: updatedCoupon.recipient.firstName,
            lastName: updatedCoupon.recipient.lastName,
          } : null,
          expiresAt: updatedCoupon.expiresAt,
          claimedAt: updatedCoupon.claimedAt,
          createdAt: updatedCoupon.createdAt,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to redeem coupon', {
      error: error instanceof Error ? error.message : String(error),
      code: req.params.code,
      body: req.body,
    })

    res.status(500).json({
      error: 'Failed to redeem coupon',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get coupon details by ID
router.get('/:id', [
  param('id').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        sender: true,
        recipient: true,
        redemptions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!coupon) {
      return res.status(404).json({
        error: 'Coupon not found',
        message: 'Invalid coupon ID',
      })
    }

    res.json({
      success: true,
      data: { coupon },
    })
  } catch (error) {
    logger.error('Failed to get coupon', {
      error: error instanceof Error ? error.message : String(error),
      id: req.params.id,
    })

    res.status(500).json({
      error: 'Failed to get coupon',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
