import { Router } from 'express'
import { stripeService } from '../services/stripeService'
import { addCouponCreatedNotificationsJob } from '../services/queueService'
import { logger } from '../utils/logger'
import { prisma } from '../index'

const router = Router()

// Stripe webhook endpoint
router.post('/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string
    const payload = JSON.stringify(req.body)

    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(payload, signature)

    logger.info('Stripe webhook received', {
      eventType: event.type,
      eventId: event.id,
    })

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object)
        break

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object)
        break

      default:
        logger.info('Unhandled Stripe event type', {
          eventType: event.type,
          eventId: event.id,
        })
    }

    res.json({ received: true })
  } catch (error) {
    logger.error('Stripe webhook error', {
        error: error instanceof Error ? error.message : String(error),
      body: req.body,
    })

    res.status(400).json({
      error: 'Webhook signature verification failed',
    })
  }
})

async function handlePaymentIntentSucceeded(paymentIntent: any) {
  try {
    // Update payment intent status
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'SUCCEEDED',
        metadata: paymentIntent.metadata,
      },
    })

    // Get the associated coupon
    const paymentRecord = await prisma.paymentIntent.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    })

    if (paymentRecord?.couponId) {
      // Update coupon status to active
      await prisma.coupon.update({
        where: { id: paymentRecord.couponId },
        data: { status: 'ACTIVE' },
      })

      // Queue notifications
      await addCouponCreatedNotificationsJob(paymentRecord.couponId)

      logger.info('Payment succeeded, coupon activated', {
        paymentIntentId: paymentIntent.id,
        couponId: paymentRecord.couponId,
      })
    }
  } catch (error) {
    logger.error('Failed to handle payment intent succeeded', {
        error: error instanceof Error ? error.message : String(error),
      paymentIntentId: paymentIntent.id,
    })
  }
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  try {
    // Update payment intent status
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'FAILED',
        metadata: paymentIntent.metadata,
      },
    })

    logger.info('Payment failed', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error,
    })
  } catch (error) {
    logger.error('Failed to handle payment intent failed', {
        error: error instanceof Error ? error.message : String(error),
      paymentIntentId: paymentIntent.id,
    })
  }
}

async function handlePaymentIntentCanceled(paymentIntent: any) {
  try {
    // Update payment intent status
    await prisma.paymentIntent.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'CANCELLED',
        metadata: paymentIntent.metadata,
      },
    })

    logger.info('Payment canceled', {
      paymentIntentId: paymentIntent.id,
    })
  } catch (error) {
    logger.error('Failed to handle payment intent canceled', {
        error: error instanceof Error ? error.message : String(error),
      paymentIntentId: paymentIntent.id,
    })
  }
}

export default router
