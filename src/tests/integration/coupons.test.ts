import request from 'supertest'
import { app } from '../../server/index'
import { testUtils } from '../setup'

describe('Coupon Integration Tests', () => {
  beforeEach(async () => {
    await testUtils.cleanupDatabase()
  })

  describe('POST /api/coupons', () => {
    it('should create a new coupon successfully', async () => {
      const couponData = {
        amount: 2500, // $25.00
        recipientEmail: 'recipient@example.com',
        recipientPhone: '+1234567890',
        title: 'Test Gift',
        message: 'Happy birthday!',
        senderEmail: 'sender@example.com',
        senderName: 'John Doe',
      }

      const response = await request(app)
        .post('/api/coupons')
        .send(couponData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.coupon).toMatchObject({
        amount: 2500,
        balance: 2500,
        currency: 'USD',
        status: 'PENDING',
        title: 'Test Gift',
        message: 'Happy birthday!',
        recipientEmail: 'recipient@example.com',
        recipientPhone: '+1234567890',
      })
      expect(response.body.data.paymentIntent).toBeDefined()
      expect(response.body.data.paymentIntent.clientSecret).toBeDefined()
    })

    it('should reject amounts below $25', async () => {
      const couponData = {
        amount: 2000, // $20.00 - below minimum
        recipientEmail: 'recipient@example.com',
        title: 'Test Gift',
        senderEmail: 'sender@example.com',
      }

      const response = await request(app)
        .post('/api/coupons')
        .send(couponData)
        .expect(400)

      expect(response.body.error).toBe('Validation failed')
    })

    it('should validate email format', async () => {
      const couponData = {
        amount: 2500,
        recipientEmail: 'invalid-email',
        title: 'Test Gift',
        senderEmail: 'sender@example.com',
      }

      const response = await request(app)
        .post('/api/coupons')
        .send(couponData)
        .expect(400)

      expect(response.body.error).toBe('Validation failed')
    })
  })

  describe('GET /api/coupons/claim/:code', () => {
    it('should return coupon details for valid code', async () => {
      // Create a test user and coupon
      const sender = await testUtils.createTestUser('sender@example.com')
      const coupon = await testUtils.createTestCoupon(sender.id)

      const response = await request(app)
        .get(`/api/coupons/claim/${coupon.code}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.coupon).toMatchObject({
        id: coupon.id,
        code: coupon.code,
        amount: coupon.amount,
        balance: coupon.balance,
        status: coupon.status,
      })
    })

    it('should return 404 for invalid code', async () => {
      const response = await request(app)
        .get('/api/coupons/claim/INVALID')
        .expect(404)

      expect(response.body.error).toBe('Coupon not found')
    })
  })

  describe('POST /api/coupons/claim/:code', () => {
    it('should claim a coupon successfully', async () => {
      // Create a test user and coupon
      const sender = await testUtils.createTestUser('sender@example.com')
      const coupon = await testUtils.createTestCoupon(sender.id)

      const claimData = {
        recipientEmail: coupon.recipientEmail,
        recipientName: 'Jane Doe',
      }

      const response = await request(app)
        .post(`/api/coupons/claim/${coupon.code}`)
        .send(claimData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.coupon.status).toBe('ACTIVE')
      expect(response.body.data.coupon.claimedAt).toBeDefined()
      expect(response.body.data.walletPasses).toBeDefined()
    })

    it('should reject claiming with wrong email', async () => {
      // Create a test user and coupon
      const sender = await testUtils.createTestUser('sender@example.com')
      const coupon = await testUtils.createTestCoupon(sender.id)

      const claimData = {
        recipientEmail: 'wrong@example.com',
        recipientName: 'Jane Doe',
      }

      const response = await request(app)
        .post(`/api/coupons/claim/${coupon.code}`)
        .send(claimData)
        .expect(403)

      expect(response.body.error).toBe('Invalid recipient')
    })
  })

  describe('POST /api/coupons/redeem/:code', () => {
    it('should redeem a coupon successfully', async () => {
      // Create a test user and claimed coupon
      const sender = await testUtils.createTestUser('sender@example.com')
      const coupon = await testUtils.createTestCoupon(sender.id, 5000) // $50.00

      // First claim the coupon
      await request(app)
        .post(`/api/coupons/claim/${coupon.code}`)
        .send({
          recipientEmail: coupon.recipientEmail,
          recipientName: 'Jane Doe',
        })

      const redemptionData = {
        amount: 2000, // $20.00
        merchantName: 'Test Store',
        merchantId: 'merchant_123',
        transactionId: 'txn_456',
      }

      const response = await request(app)
        .post(`/api/coupons/redeem/${coupon.code}`)
        .send(redemptionData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.redemption).toMatchObject({
        amount: 2000,
        merchantName: 'Test Store',
        merchantId: 'merchant_123',
        transactionId: 'txn_456',
        status: 'APPROVED',
      })
      expect(response.body.data.coupon.balance).toBe(3000) // $30.00 remaining
    })

    it('should reject redemption exceeding balance', async () => {
      // Create a test user and claimed coupon
      const sender = await testUtils.createTestUser('sender@example.com')
      const coupon = await testUtils.createTestCoupon(sender.id, 2500) // $25.00

      // First claim the coupon
      await request(app)
        .post(`/api/coupons/claim/${coupon.code}`)
        .send({
          recipientEmail: coupon.recipientEmail,
          recipientName: 'Jane Doe',
        })

      const redemptionData = {
        amount: 3000, // $30.00 - exceeds balance
        merchantName: 'Test Store',
      }

      const response = await request(app)
        .post(`/api/coupons/redeem/${coupon.code}`)
        .send(redemptionData)
        .expect(400)

      expect(response.body.error).toBe('Insufficient balance')
    })
  })
})
