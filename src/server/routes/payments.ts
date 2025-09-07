import { Router, Request, Response } from 'express'
import { body, param, validationResult } from 'express-validator'
import { prisma } from '../index'
import { stripeService } from '../services/stripeService'
import { addCouponCreatedNotificationsJob } from '../services/queueService'
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

// Create payment intent
router.post('/create-intent', [
  body('amount').isInt({ min: 2500 }).withMessage('Amount must be at least $25.00'),
  body('currency').optional().isIn(['USD']),
  body('metadata').optional().isObject(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'USD', metadata = {} } = req.body

    const paymentIntent = await stripeService.createPaymentIntent(
      amount / 100, // Convert from cents to dollars
      currency,
      metadata
    )

    logger.info('Payment intent created', {
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency,
      metadata,
    })

    res.json({
      success: true,
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          metadata: paymentIntent.metadata,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : String(error),
      body: req.body,
    })

    res.status(500).json({
      error: 'Failed to create payment intent',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Confirm payment intent
router.post('/confirm/:paymentIntentId', [
  param('paymentIntentId').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.params

    const paymentIntent = await stripeService.confirmPaymentIntent(paymentIntentId)

    // Get payment record from database
    const paymentRecord = await prisma.paymentIntent.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    })

    // Update payment intent in database
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: paymentIntent.status.toUpperCase() as any,
        metadata: paymentIntent.metadata,
      },
    })

    // If payment succeeded, activate coupon and send notifications
    if (paymentIntent.status === 'succeeded' && paymentRecord?.couponId) {
      // Update coupon status to active
      await prisma.coupon.update({
        where: { id: paymentRecord.couponId },
        data: { status: 'ACTIVE' },
      })

      // Queue notifications
      await addCouponCreatedNotificationsJob(paymentRecord.couponId)

      logger.info('Payment succeeded, coupon activated', {
        paymentIntentId,
        couponId: paymentRecord.couponId,
      })
    }

    logger.info('Payment intent confirmed', {
      paymentIntentId,
      status: paymentIntent.status,
    })

    res.json({
      success: true,
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          metadata: paymentIntent.metadata,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to confirm payment intent', {
        error: error instanceof Error ? error.message : String(error),
      paymentIntentId: req.params.paymentIntentId,
    })

    res.status(500).json({
      error: 'Failed to confirm payment intent',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Refund payment
router.post('/refund/:paymentIntentId', [
  param('paymentIntentId').isString(),
  body('amount').optional().isInt({ min: 1 }),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.params
    const { amount } = req.body

    const refund = await stripeService.refundPayment(paymentIntentId, amount)

    // Update payment intent status
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: 'REFUNDED' },
    })

    logger.info('Payment refunded', {
      paymentIntentId,
      refundId: refund.id,
      amount: refund.amount,
    })

    res.json({
      success: true,
      data: {
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to refund payment', {
        error: error instanceof Error ? error.message : String(error),
      paymentIntentId: req.params.paymentIntentId,
      body: req.body,
    })

    res.status(500).json({
      error: 'Failed to refund payment',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Get payment intent details
router.get('/:paymentIntentId', [
  param('paymentIntentId').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.params

    const paymentRecord = await prisma.paymentIntent.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    })

    if (!paymentRecord) {
      return res.status(404).json({
        error: 'Payment intent not found',
        message: 'Invalid payment intent ID',
      })
    }

    res.json({
      success: true,
      data: {
        paymentIntent: {
          id: paymentRecord.id,
          stripePaymentIntentId: paymentRecord.stripePaymentIntentId,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          status: paymentRecord.status,
          metadata: paymentRecord.metadata,
          createdAt: paymentRecord.createdAt,
          updatedAt: paymentRecord.updatedAt,
          couponId: paymentRecord.couponId,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to get payment intent', {
        error: error instanceof Error ? error.message : String(error),
      paymentIntentId: req.params.paymentIntentId,
    })

    res.status(500).json({
      error: 'Failed to get payment intent',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Create customer for split payments
router.post('/customer', [
  body('email').isEmail().normalizeEmail(),
  body('name').optional().isString().trim().isLength({ max: 255 }),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body

    const customer = await stripeService.createCustomer(email, name)

    logger.info('Customer created', {
      customerId: customer.id,
      email: customer.email,
      name: customer.name,
    })

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to create customer', {
        error: error instanceof Error ? error.message : String(error),
      body: req.body,
    })

    res.status(500).json({
      error: 'Failed to create customer',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Create setup intent for saving payment method
router.post('/setup-intent', [
  body('customerId').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { customerId } = req.body

    const setupIntent = await stripeService.createSetupIntent(customerId)

    logger.info('Setup intent created', {
      setupIntentId: setupIntent.id,
      customerId,
    })

    res.json({
      success: true,
      data: {
        setupIntent: {
          id: setupIntent.id,
          clientSecret: setupIntent.client_secret,
          status: setupIntent.status,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to create setup intent', {
        error: error instanceof Error ? error.message : String(error),
      body: req.body,
    })

    res.status(500).json({
      error: 'Failed to create setup intent',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Charge customer (for split payments)
router.post('/charge', [
  body('customerId').isString(),
  body('amount').isInt({ min: 1 }),
  body('paymentMethodId').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { customerId, amount, paymentMethodId } = req.body

    const paymentIntent = await stripeService.chargeCustomer(
      customerId,
      amount / 100, // Convert from cents to dollars
      paymentMethodId
    )

    logger.info('Customer charged', {
      paymentIntentId: paymentIntent.id,
      customerId,
      amount,
      paymentMethodId,
    })

    res.json({
      success: true,
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        },
      },
    })
  } catch (error) {
    logger.error('Failed to charge customer', {
        error: error instanceof Error ? error.message : String(error),
      body: req.body,
    })

    res.status(500).json({
      error: 'Failed to charge customer',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
