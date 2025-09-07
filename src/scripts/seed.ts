import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create test users
  const sender = await prisma.user.upsert({
    where: { email: 'sender@example.com' },
    update: {},
    create: {
      email: 'sender@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
    },
  })

  const recipient = await prisma.user.upsert({
    where: { email: 'recipient@example.com' },
    update: {},
    create: {
      email: 'recipient@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+1987654321',
    },
  })

  console.log('✅ Created test users')

  // Create test coupons
  const coupon1 = await prisma.coupon.create({
    data: {
      code: 'TEST1234',
      amount: 5000, // $50.00
      balance: 5000,
      currency: 'USD',
      status: 'ACTIVE',
      title: 'Coffee Gift',
      message: 'Enjoy your morning coffee!',
      senderId: sender.id,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      recipientPhone: recipient.phone,
      claimedAt: new Date(),
    },
  })

  const coupon2 = await prisma.coupon.create({
    data: {
      code: 'TEST5678',
      amount: 2500, // $25.00
      balance: 1500, // Partially redeemed
      currency: 'USD',
      status: 'ACTIVE',
      title: 'Restaurant Gift',
      message: 'Have a great meal!',
      senderId: sender.id,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      recipientPhone: recipient.phone,
      claimedAt: new Date(),
    },
  })

  const coupon3 = await prisma.coupon.create({
    data: {
      code: 'TEST9999',
      amount: 10000, // $100.00
      balance: 0, // Fully redeemed
      currency: 'USD',
      status: 'REDEEMED',
      title: 'Shopping Spree',
      message: 'Treat yourself!',
      senderId: sender.id,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      recipientPhone: recipient.phone,
      claimedAt: new Date(),
    },
  })

  console.log('✅ Created test coupons')

  // Create test redemptions
  await prisma.redemption.create({
    data: {
      couponId: coupon2.id,
      amount: 1000, // $10.00
      merchantName: 'Test Coffee Shop',
      merchantId: 'merchant_123',
      transactionId: 'txn_456',
      status: 'APPROVED',
    },
  })

  await prisma.redemption.create({
    data: {
      couponId: coupon3.id,
      amount: 10000, // $100.00
      merchantName: 'Test Store',
      merchantId: 'merchant_789',
      transactionId: 'txn_101112',
      status: 'APPROVED',
    },
  })

  console.log('✅ Created test redemptions')

  // Create test payment intents
  await prisma.paymentIntent.create({
    data: {
      stripePaymentIntentId: 'pi_test_123456789',
      couponId: coupon1.id,
      amount: 5000,
      currency: 'USD',
      status: 'SUCCEEDED',
      metadata: {
        couponId: coupon1.id,
        couponCode: coupon1.code,
        senderEmail: sender.email,
        recipientEmail: recipient.email,
      },
    },
  })

  console.log('✅ Created test payment intents')

  // Create test notifications
  await prisma.notification.create({
    data: {
      userId: sender.id,
      couponId: coupon1.id,
      type: 'COUPON_CREATED',
      channel: 'EMAIL',
      status: 'SENT',
      subject: 'Gift Coupon Created Successfully',
      content: 'Your gift coupon has been created and sent to the recipient.',
      recipient: sender.email,
      sentAt: new Date(),
    },
  })

  await prisma.notification.create({
    data: {
      userId: recipient.id,
      couponId: coupon1.id,
      type: 'COUPON_CLAIMED',
      channel: 'EMAIL',
      status: 'SENT',
      subject: 'Gift Coupon Claimed',
      content: 'Your gift coupon has been claimed and is ready to use.',
      recipient: recipient.email,
      sentAt: new Date(),
    },
  })

  console.log('✅ Created test notifications')

  // Create test wallet passes
  await prisma.walletPass.create({
    data: {
      couponId: coupon1.id,
      applePassUrl: 'http://localhost:3001/api/wallet/mock-pass/TEST1234',
      googlePassUrl: 'https://pay.google.com/gp/v/save/mock_google_pass',
      passData: {
        serialNumber: coupon1.code,
        description: `Gift Coupon - ${coupon1.title}`,
        organizationName: 'Gift Coupon App',
        logoText: 'Gift Coupon',
        storeCard: {
          primaryFields: [
            {
              key: 'balance',
              label: 'Balance',
              value: `$${(coupon1.balance / 100).toFixed(2)}`,
            },
          ],
        },
      },
      status: 'GENERATED',
    },
  })

  console.log('✅ Created test wallet passes')

  console.log('🎉 Database seeding completed successfully!')
  console.log('\n📋 Test Data Summary:')
  console.log(`- Users: 2 (sender@example.com, recipient@example.com)`)
  console.log(`- Coupons: 3 (TEST1234, TEST5678, TEST9999)`)
  console.log(`- Redemptions: 2`)
  console.log(`- Payment Intents: 1`)
  console.log(`- Notifications: 2`)
  console.log(`- Wallet Passes: 1`)
  console.log('\n🔗 Test URLs:')
  console.log(`- Claim coupon: http://localhost:3001/claim/TEST1234`)
  console.log(`- Admin dashboard: http://localhost:3001/admin`)
  console.log(`- API docs: http://localhost:3000/api-docs`)
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
