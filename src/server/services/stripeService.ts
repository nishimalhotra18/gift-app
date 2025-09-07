import Stripe from 'stripe'
import { logger } from '../utils/logger'

export class StripeService {
  private stripe: Stripe

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    })
  }

  async createPaymentIntent(amount: number, currency: string = 'USD', metadata: any = {}) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amount * 100, // Convert to cents
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      })

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        metadata,
      })

      return paymentIntent
    } catch (error) {
      logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : String(error),
        amount,
        currency,
        metadata,
      })
      throw error
    }
  }

  async confirmPaymentIntent(paymentIntentId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId)
      
      logger.info('Payment intent retrieved', {
        paymentIntentId,
        status: paymentIntent.status,
      })

      return paymentIntent
    } catch (error) {
      logger.error('Failed to retrieve payment intent', {
        error: error instanceof Error ? error.message : String(error),
        paymentIntentId,
      })
      throw error
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? amount * 100 : undefined, // Convert to cents if specified
      })

      logger.info('Payment refunded', {
        paymentIntentId,
        refundId: refund.id,
        amount: refund.amount,
      })

      return refund
    } catch (error) {
      logger.error('Failed to refund payment', {
        error: error instanceof Error ? error.message : String(error),
        paymentIntentId,
        amount,
      })
      throw error
    }
  }

  async createCustomer(email: string, name?: string) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
      })

      logger.info('Customer created', {
        customerId: customer.id,
        email,
        name,
      })

      return customer
    } catch (error) {
      logger.error('Failed to create customer', {
        error: error instanceof Error ? error.message : String(error),
        email,
        name,
      })
      throw error
    }
  }

  async createSetupIntent(customerId: string) {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      })

      logger.info('Setup intent created', {
        setupIntentId: setupIntent.id,
        customerId,
      })

      return setupIntent
    } catch (error) {
      logger.error('Failed to create setup intent', {
        error: error instanceof Error ? error.message : String(error),
        customerId,
      })
      throw error
    }
  }

  async chargeCustomer(customerId: string, amount: number, paymentMethodId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amount * 100, // Convert to cents
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
      })

      logger.info('Customer charged', {
        paymentIntentId: paymentIntent.id,
        customerId,
        amount,
        paymentMethodId,
      })

      return paymentIntent
    } catch (error) {
      logger.error('Failed to charge customer', {
        error: error instanceof Error ? error.message : String(error),
        customerId,
        amount,
        paymentMethodId,
      })
      throw error
    }
  }

  verifyWebhookSignature(payload: string, signature: string) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
      return event
    } catch (error) {
      logger.error('Webhook signature verification failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }
}

export const stripeService = new StripeService()
