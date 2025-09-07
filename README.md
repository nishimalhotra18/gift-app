# Gift Coupon App

A complete end-to-end gift coupon web application with wallet integration, built with TypeScript, Node.js, Next.js, and PostgreSQL.

## 🎯 Features

- **Create Gift Coupons**: Send digital gift coupons to anyone via email/SMS
- **Wallet Integration**: Apple Wallet and Google Wallet support
- **Payment Processing**: Stripe integration with 4% processing fee
- **US-Only Restriction**: Geographic restriction enforcement
- **Real-time Notifications**: Email and SMS notifications with retry logic
- **Admin Dashboard**: Monitor coupons, payments, and notifications
- **Split Payments**: Support for partial redemption with auto-make-whole
- **Fallback Logic**: Graceful degradation when integrations fail

## 🏗️ Architecture

### Backend (Node.js + Express)
- **Services**: Coupon, Payment, Wallet, Notification, Queue
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session management and queuing
- **External APIs**: Stripe, Twilio (SMS), SMTP (Email)
- **Security**: Geographic restrictions, input validation, rate limiting

### Frontend (Next.js + React)
- **UI**: Tailwind CSS with responsive design
- **State Management**: React Query for server state
- **Forms**: React Hook Form with validation
- **Payments**: Stripe Elements integration
- **Notifications**: Toast notifications with React Hot Toast

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Stripe account (test keys)
- Twilio account (for SMS)
- SMTP email service (Gmail, etc.)

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd gift-coupon-app
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Set up the database**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start the development servers**:
   ```bash
   npm run dev
   ```

5. **Access the application**:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - API Documentation: http://localhost:3000/api-docs
   - Admin Dashboard: http://localhost:3001/admin

## 📋 Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/gift_coupon_app"

# Redis
REDIS_URL="redis://localhost:6379"

# Stripe (Test Keys)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Gift Coupon App <noreply@yourdomain.com>"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1234567890"

# Application
NODE_ENV="development"
PORT="3000"
CLIENT_PORT="3001"
JWT_SECRET="your-jwt-secret-key"
ENCRYPTION_KEY="your-32-character-encryption-key"

# Geographic Restriction
ENFORCE_US_ONLY="true"
ALLOWED_COUNTRIES="US"
```

### Optional Variables

```bash
# Azure (Mock)
AZURE_STORAGE_ACCOUNT_NAME="mockaccount"
AZURE_STORAGE_ACCOUNT_KEY="mockkey"
AZURE_STORAGE_CONTAINER_NAME="coupons"

# Wallet (Development)
APPLE_WALLET_PASS_TYPE_ID="pass.com.yourcompany.giftcoupon"
APPLE_WALLET_TEAM_ID="your-team-id"
APPLE_WALLET_CERTIFICATE_PATH="./certs/apple-wallet-cert.pem"
APPLE_WALLET_KEY_PATH="./certs/apple-wallet-key.pem"

# API Documentation
API_DOCS_ENABLED="true"
API_DOCS_PATH="/api-docs"
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:server       # Start backend only
npm run dev:client       # Start frontend only

# Building
npm run build            # Build both frontend and backend
npm run build:server     # Build backend only
npm run build:client     # Build frontend only

# Production
npm run start            # Start both frontend and backend
npm run start:server     # Start backend only
npm run start:client     # Start frontend only

# Database
npm run db:migrate       # Run database migrations
npm run db:seed          # Seed database with test data
npm run db:reset         # Reset database
npm run db:studio        # Open Prisma Studio

# Testing
npm run test             # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:integration # Run integration tests

# Linting
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run type-check       # Run TypeScript type checking
```

### Project Structure

```
gift-coupon-app/
├── src/
│   ├── server/                 # Backend server
│   │   ├── index.ts           # Server entry point
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic services
│   │   ├── middleware/        # Express middleware
│   │   └── utils/             # Utility functions
│   ├── client/                # Frontend client
│   │   ├── src/
│   │   │   ├── app/           # Next.js app directory
│   │   │   ├── components/    # React components
│   │   │   └── lib/           # Client utilities
│   │   └── package.json       # Client dependencies
│   └── scripts/               # Utility scripts
├── prisma/                    # Database schema and migrations
├── package.json               # Root package.json
└── README.md
```

## 🔌 API Endpoints

### Coupons
- `POST /api/coupons` - Create a new coupon
- `GET /api/coupons/claim/:code` - Get coupon details for claiming
- `POST /api/coupons/claim/:code` - Claim a coupon
- `POST /api/coupons/redeem/:code` - Redeem a coupon (full/partial)
- `GET /api/coupons/:id` - Get coupon details by ID

### Payments
- `POST /api/payments/create-intent` - Create Stripe payment intent
- `POST /api/payments/confirm/:id` - Confirm payment intent
- `POST /api/payments/refund/:id` - Refund payment
- `GET /api/payments/:id` - Get payment intent details

### Wallet
- `GET /api/wallet/passes/:couponId` - Get wallet passes for coupon
- `POST /api/wallet/apple/:couponId` - Generate Apple Wallet pass
- `POST /api/wallet/google/:couponId` - Generate Google Wallet pass
- `GET /api/wallet/pass/:filename` - Serve Apple Wallet pass file
- `GET /api/wallet/mock-pass/:code` - Mock Apple Wallet pass (dev)

### Notifications
- `GET /api/notifications/user/:userId` - Get user notifications
- `GET /api/notifications/:id` - Get notification details
- `POST /api/notifications/:id/retry` - Retry failed notification

### Admin
- `GET /api/admin/dashboard` - Get dashboard overview
- `GET /api/admin/coupons` - Get coupons with filters
- `GET /api/admin/users` - Get users with filters
- `GET /api/admin/payments` - Get payment intents
- `GET /api/admin/notifications` - Get notifications
- `POST /api/admin/notifications/retry-failed` - Retry all failed notifications

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook endpoint

## 🧪 Testing

### Test Data

The seed script creates test data for development:

- **Users**: sender@example.com, recipient@example.com
- **Coupons**: TEST1234 ($50), TEST5678 ($25), TEST9999 ($100)
- **Redemptions**: Partial and full redemption examples
- **Notifications**: Email and SMS examples
- **Wallet Passes**: Mock Apple Wallet pass

### Test URLs

- **Claim coupon**: http://localhost:3001/claim/TEST1234
- **Admin dashboard**: http://localhost:3001/admin
- **API documentation**: http://localhost:3000/api-docs

### Integration Tests

```bash
npm run test:integration
```

Tests cover:
- Coupon creation and payment flow
- Wallet pass generation
- Notification delivery
- Geographic restrictions
- Error handling and fallbacks

## 🔒 Security Features

### Geographic Restrictions
- US-only usage enforcement
- IP-based location detection (mock for development)
- Configurable allowed countries

### Input Validation
- Joi schema validation
- SQL injection prevention
- XSS protection with CSP headers

### Rate Limiting
- 100 requests per 15 minutes per IP
- Configurable limits per endpoint

### Data Protection
- Sensitive data encryption
- Secure environment variable handling
- PCI compliance through Stripe

## 📱 Wallet Integration

### Apple Wallet
- Generates `.pkpass` files
- Includes coupon details, balance, sender info
- Mock mode for development
- Real certificate support for production

### Google Wallet
- Generates Google Save URLs
- Pass data in JWT format
- Compatible with Google Pay

### Development Mode
- Mock wallet passes for testing
- Downloadable pass files
- Visual pass preview

## 🔄 Notification System

### Multi-Channel Delivery
- **Email**: SMTP integration (Gmail, etc.)
- **SMS**: Twilio integration
- **Push**: Ready for future implementation

### Retry Logic
- Exponential backoff
- Configurable retry attempts
- Failed notification tracking
- Admin retry functionality

### Templates
- Coupon created notifications
- Claim confirmation
- Redemption notifications
- Error notifications

## 🎛️ Admin Dashboard

### Overview
- Total coupons, users, revenue
- Recent activity
- Failed notifications count

### Management
- View and filter coupons
- User management
- Payment monitoring
- Notification status tracking

### Operations
- Retry failed notifications
- Bulk operations
- System health monitoring

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**:
   - Set production database URL
   - Configure production Stripe keys
   - Set up production email/SMS services
   - Configure geographic restrictions

2. **Database**:
   - Run migrations: `npm run db:migrate`
   - Set up database backups
   - Configure connection pooling

3. **Security**:
   - Enable HTTPS
   - Configure CORS origins
   - Set up rate limiting
   - Enable geographic restrictions

4. **Monitoring**:
   - Set up logging
   - Configure error tracking
   - Monitor notification delivery
   - Set up alerts

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individual services
docker build -t gift-coupon-backend ./src/server
docker build -t gift-coupon-frontend ./src/client
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow the existing code style
- Test with both mock and real integrations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues

**Database Connection Issues**:
- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Verify database exists

**Stripe Integration Issues**:
- Verify test keys are correct
- Check webhook endpoint configuration
- Ensure webhook secret matches

**Email/SMS Issues**:
- Verify SMTP/Twilio credentials
- Check rate limits
- Review notification queue status

**Geographic Restriction Issues**:
- Check ENFORCE_US_ONLY setting
- Verify IP detection logic
- Test with different IP addresses

### Getting Help

- Check the API documentation: http://localhost:3000/api-docs
- Review the test data and examples
- Check the logs for error details
- Use the admin dashboard for monitoring

## 🎉 Success Criteria

✅ **Complete End-to-End Flow**:
1. Create coupon → Database row + notify gifter & recipient
2. Open claim link → Add to wallet (mock) → Notify gifter
3. Redeem full/partial → DB updates balance → Notify recipient
4. US-only restriction enforced
5. Fallback queues retry when integrations are down

✅ **All Requirements Met**:
- Merchant-independent experience (no MCC filtering)
- US-only geographic restriction
- Mock Azure credentials with working flows
- Full Stripe integration with test keys
- Email/SMS notifications with templates
- Apple/Google Wallet payload generation
- Graceful degradation and retry logic
- Complete admin dashboard
- Comprehensive testing and documentation

The application is ready for development and testing with all requested features implemented!