import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { Express } from 'express'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Gift Coupon API',
      version: '1.0.0',
      description: 'API for managing gift coupons with wallet integration',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://yourdomain.com' 
          : 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Coupon: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            code: { type: 'string' },
            amount: { type: 'integer', description: 'Amount in cents' },
            balance: { type: 'integer', description: 'Remaining balance in cents' },
            currency: { type: 'string', default: 'USD' },
            status: { 
              type: 'string', 
              enum: ['PENDING', 'ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED'] 
            },
            title: { type: 'string' },
            message: { type: 'string' },
            recipientEmail: { type: 'string', format: 'email' },
            recipientPhone: { type: 'string' },
            sender: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
              },
            },
            recipient: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
              },
            },
            expiresAt: { type: 'string', format: 'date-time' },
            claimedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PaymentIntent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            stripePaymentIntentId: { type: 'string' },
            amount: { type: 'integer', description: 'Amount in cents' },
            currency: { type: 'string', default: 'USD' },
            status: { 
              type: 'string', 
              enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'] 
            },
            metadata: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Redemption: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            amount: { type: 'integer', description: 'Amount redeemed in cents' },
            merchantName: { type: 'string' },
            merchantId: { type: 'string' },
            transactionId: { type: 'string' },
            status: { 
              type: 'string', 
              enum: ['PENDING', 'APPROVED', 'DECLINED', 'REFUNDED'] 
            },
            metadata: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { 
              type: 'string', 
              enum: ['COUPON_CREATED', 'COUPON_CLAIMED', 'COUPON_REDEEMED', 'COUPON_EXPIRED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED'] 
            },
            channel: { 
              type: 'string', 
              enum: ['EMAIL', 'SMS', 'PUSH'] 
            },
            status: { 
              type: 'string', 
              enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED'] 
            },
            subject: { type: 'string' },
            content: { type: 'string' },
            recipient: { type: 'string' },
            sentAt: { type: 'string', format: 'date-time' },
            deliveredAt: { type: 'string', format: 'date-time' },
            errorMessage: { type: 'string' },
            retryCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            code: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            details: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    tags: [
      {
        name: 'Coupons',
        description: 'Coupon management operations',
      },
      {
        name: 'Payments',
        description: 'Payment processing operations',
      },
      {
        name: 'Wallet',
        description: 'Wallet integration operations',
      },
      {
        name: 'Notifications',
        description: 'Notification management operations',
      },
      {
        name: 'Admin',
        description: 'Administrative operations',
      },
      {
        name: 'Webhooks',
        description: 'Webhook endpoints',
      },
    ],
  },
  apis: ['./src/server/routes/*.ts'], // Path to the API files
}

const specs = swaggerJsdoc(options)

export function setupSwagger(app: Express) {
  const docsPath = process.env.API_DOCS_PATH || '/api-docs'
  
  app.use(docsPath, swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Gift Coupon API Documentation',
  }))

  console.log(`API documentation available at http://localhost:${process.env.PORT || 3000}${docsPath}`)
}
