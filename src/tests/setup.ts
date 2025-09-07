import { PrismaClient } from '@prisma/client'

// Global test setup
beforeAll(async () => {
  // Set up test environment
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/gift_coupon_test'
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
  
  // Mock external services for testing
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock'
  
  process.env.SMTP_HOST = 'smtp.test.com'
  process.env.SMTP_PORT = '587'
  process.env.SMTP_USER = 'test@test.com'
  process.env.SMTP_PASS = 'test_password'
  process.env.SMTP_FROM = 'Test App <test@test.com>'
  
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = 'test_token'
  process.env.TWILIO_PHONE_NUMBER = '+1234567890'
  
  process.env.JWT_SECRET = 'test_jwt_secret'
  process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars'
  process.env.ENFORCE_US_ONLY = 'false' // Disable for testing
})

afterAll(async () => {
  // Cleanup after all tests
})

// Global test utilities
export const testUtils = {
  async cleanupDatabase() {
    const prisma = new PrismaClient()
    try {
      // Clean up test data
      await prisma.notification.deleteMany()
      await prisma.walletPass.deleteMany()
      await prisma.redemption.deleteMany()
      await prisma.paymentIntent.deleteMany()
      await prisma.coupon.deleteMany()
      await prisma.user.deleteMany()
    } finally {
      await prisma.$disconnect()
    }
  },
  
  async createTestUser(email: string = 'test@example.com') {
    const prisma = new PrismaClient()
    try {
      return await prisma.user.create({
        data: {
          email,
          firstName: 'Test',
          lastName: 'User',
        },
      })
    } finally {
      await prisma.$disconnect()
    }
  },
  
  async createTestCoupon(senderId: string, amount: number = 2500) {
    const prisma = new PrismaClient()
    try {
      return await prisma.coupon.create({
        data: {
          code: `TEST${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          amount,
          balance: amount,
          currency: 'USD',
          status: 'ACTIVE',
          title: 'Test Coupon',
          message: 'Test message',
          senderId,
          recipientEmail: 'recipient@example.com',
        },
      })
    } finally {
      await prisma.$disconnect()
    }
  },
}
