import { Router, Request, Response } from 'express'
import { param, validationResult } from 'express-validator'
import { walletService } from '../services/walletService'
import { logger } from '../utils/logger'
import * as fs from 'fs'
import * as path from 'path'

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

// Get wallet passes for a coupon
router.get('/passes/:couponId', [
  param('couponId').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { couponId } = req.params

    const walletPasses = await walletService.getWalletPasses(couponId)

    logger.info('Wallet passes retrieved', {
      couponId,
      count: walletPasses.length,
    })

    res.json({
      success: true,
      data: { walletPasses },
    })
  } catch (error) {
    logger.error('Failed to get wallet passes', {
        error: error instanceof Error ? error.message : String(error),
      couponId: req.params.couponId,
    })

    res.status(500).json({
      error: 'Failed to get wallet passes',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Generate Apple Wallet pass
router.post('/apple/:couponId', [
  param('couponId').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { couponId } = req.params

    const applePass = await walletService.generateAppleWalletPass(couponId)

    logger.info('Apple Wallet pass generated', {
      couponId,
      passUrl: applePass.passUrl,
    })

    res.json({
      success: true,
      data: { applePass },
    })
  } catch (error) {
    logger.error('Failed to generate Apple Wallet pass', {
        error: error instanceof Error ? error.message : String(error),
      couponId: req.params.couponId,
    })

    res.status(500).json({
      error: 'Failed to generate Apple Wallet pass',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Generate Google Wallet pass
router.post('/google/:couponId', [
  param('couponId').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { couponId } = req.params

    const googlePass = await walletService.generateGoogleWalletPass(couponId)

    logger.info('Google Wallet pass generated', {
      couponId,
      saveUrl: googlePass.passUrl,
    })

    res.json({
      success: true,
      data: { googlePass },
    })
  } catch (error) {
    logger.error('Failed to generate Google Wallet pass', {
        error: error instanceof Error ? error.message : String(error),
      couponId: req.params.couponId,
    })

    res.status(500).json({
      error: 'Failed to generate Google Wallet pass',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Generate both wallet passes
router.post('/generate/:couponId', [
  param('couponId').isString(),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { couponId } = req.params

    const walletPasses = await walletService.getWalletPasses(couponId)

    logger.info('Wallet passes generated', {
      couponId,
      count: walletPasses.length,
    })

    res.json({
      success: true,
      data: { walletPasses },
    })
  } catch (error) {
    logger.error('Failed to generate wallet passes', {
        error: error instanceof Error ? error.message : String(error),
      couponId: req.params.couponId,
    })

    res.status(500).json({
      error: 'Failed to generate wallet passes',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Serve Apple Wallet pass file
router.get('/pass/:filename', [
  param('filename').matches(/^coupon-.*\.pkpass$/),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params
    const passPath = path.join(__dirname, '../../public/passes', filename)

    if (!fs.existsSync(passPath)) {
      return res.status(404).json({
        error: 'Pass file not found',
        message: 'The requested pass file does not exist',
      })
    }

    res.setHeader('Content-Type', 'application/vnd.apple.pkpass')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.sendFile(passPath)

    logger.info('Apple Wallet pass served', {
      filename,
    })
  } catch (error) {
    logger.error('Failed to serve Apple Wallet pass', {
        error: error instanceof Error ? error.message : String(error),
      filename: req.params.filename,
    })

    res.status(500).json({
      error: 'Failed to serve pass file',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Mock Apple Wallet pass for development
router.get('/mock-pass/:couponCode', [
  param('couponCode').isString().isLength({ min: 8, max: 8 }),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { couponCode } = req.params

    // Generate mock pass data
    const mockPassData = {
      serialNumber: couponCode,
      description: `Gift Coupon - ${couponCode}`,
      organizationName: 'Gift Coupon App (Mock)',
      logoText: 'Gift Coupon',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(0, 123, 255)',
      labelColor: 'rgb(255, 255, 255)',
      storeCard: {
        primaryFields: [
          {
            key: 'balance',
            label: 'Balance',
            value: '$25.00',
          },
        ],
        secondaryFields: [
          {
            key: 'sender',
            label: 'From',
            value: 'Anonymous',
          },
          {
            key: 'message',
            label: 'Message',
            value: 'Enjoy your gift!',
          },
        ],
        auxiliaryFields: [
          {
            key: 'code',
            label: 'Coupon Code',
            value: couponCode,
          },
        ],
      },
    }

    // Create a simple HTML page that simulates the pass
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Apple Wallet Pass</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .pass { background: linear-gradient(135deg, #007bff, #0056b3); color: white; border-radius: 10px; padding: 20px; margin: 20px 0; }
          .pass-header { text-align: center; margin-bottom: 20px; }
          .pass-title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .pass-subtitle { font-size: 16px; opacity: 0.8; }
          .pass-field { display: flex; justify-content: space-between; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.2); }
          .pass-field:last-child { border-bottom: none; }
          .field-label { font-weight: 500; }
          .field-value { font-weight: bold; }
          .mock-notice { background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
          .download-btn { background: #28a745; color: white; padding: 15px 30px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="mock-notice">
          <strong>Development Mode:</strong> This is a mock Apple Wallet pass for testing purposes.
        </div>
        
        <div class="pass">
          <div class="pass-header">
            <div class="pass-title">Gift Coupon</div>
            <div class="pass-subtitle">Mock Pass - ${couponCode}</div>
          </div>
          
          <div class="pass-field">
            <span class="field-label">Balance</span>
            <span class="field-value">$25.00</span>
          </div>
          
          <div class="pass-field">
            <span class="field-label">From</span>
            <span class="field-value">Anonymous</span>
          </div>
          
          <div class="pass-field">
            <span class="field-label">Message</span>
            <span class="field-value">Enjoy your gift!</span>
          </div>
          
          <div class="pass-field">
            <span class="field-label">Coupon Code</span>
            <span class="field-value">${couponCode}</span>
          </div>
        </div>
        
        <button class="download-btn" onclick="downloadMockPass()">Download Mock Pass</button>
        
        <script>
          function downloadMockPass() {
            // Create a mock .pkpass file (actually a text file)
            const mockPassContent = JSON.stringify(${JSON.stringify(mockPassData)}, null, 2);
            const blob = new Blob([mockPassContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'coupon-${couponCode}.pkpass';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        </script>
      </body>
      </html>
    `

    res.setHeader('Content-Type', 'text/html')
    res.send(html)

    logger.info('Mock Apple Wallet pass served', {
      couponCode,
    })
  } catch (error) {
    logger.error('Failed to serve mock Apple Wallet pass', {
        error: error instanceof Error ? error.message : String(error),
      couponCode: req.params.couponCode,
    })

    res.status(500).json({
      error: 'Failed to serve mock pass',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Serve wallet pass images
router.get('/image/:imageName', [
  param('imageName').matches(/^[a-zA-Z0-9-_]+$/),
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { imageName } = req.params
    const imagePath = path.join(__dirname, '../../assets/images', `${imageName}.png`)

    if (!fs.existsSync(imagePath)) {
      // Return a default image or 404
      return res.status(404).json({
        error: 'Image not found',
        message: 'The requested image does not exist',
      })
    }

    res.setHeader('Content-Type', 'image/png')
    res.sendFile(imagePath)

    logger.info('Wallet pass image served', {
      imageName,
    })
  } catch (error) {
    logger.error('Failed to serve wallet pass image', {
        error: error instanceof Error ? error.message : String(error),
      imageName: req.params.imageName,
    })

    res.status(500).json({
      error: 'Failed to serve image',
        message: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
