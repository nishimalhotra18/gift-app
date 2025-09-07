import nodemailer from 'nodemailer'
import twilio from 'twilio'
import { logger } from '../utils/logger'
import { prisma } from '../index'
import { NotificationType, NotificationChannel, NotificationStatus } from '@prisma/client'

export class NotificationService {
  private emailTransporter: nodemailer.Transporter
  private twilioClient: twilio.Twilio

  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'mock@gmail.com',
        pass: process.env.SMTP_PASS || 'mock_password',
      },
    })

    // Initialize Twilio client with mock credentials if not provided
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID || 'ACmock_account_sid',
      process.env.TWILIO_AUTH_TOKEN || 'mock_auth_token'
    )
  }

  async sendEmail(to: string, subject: string, content: string, metadata?: any) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'mock@gmail.com',
        to,
        subject,
        html: content,
      }

      const result = await this.emailTransporter.sendMail(mailOptions)
      
      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.messageId,
        metadata,
      })

      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
      }
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : String(error),
        to,
        subject,
        metadata,
      })
      throw error
    }
  }

  async sendSMS(to: string, message: string, metadata?: any) {
    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
        to,
      })

      logger.info('SMS sent successfully', {
        to,
        messageSid: result.sid,
        status: result.status,
        metadata,
      })

      return {
        success: true,
        messageSid: result.sid,
        status: result.status,
      }
    } catch (error) {
      logger.error('Failed to send SMS', {
        error: error instanceof Error ? error.message : String(error),
        to,
        metadata,
      })
      throw error
    }
  }

  async createNotification(
    type: NotificationType,
    channel: NotificationChannel,
    recipient: string,
    content: string,
    userId?: string,
    couponId?: string,
    subject?: string
  ) {
    try {
      const notification = await prisma.notification.create({
        data: {
          type,
          channel,
          recipient,
          content,
          subject,
          userId,
          couponId,
          status: NotificationStatus.PENDING,
        },
      })

      logger.info('Notification created', {
        notificationId: notification.id,
        type,
        channel,
        recipient,
        userId,
        couponId,
      })

      return notification
    } catch (error) {
      logger.error('Failed to create notification', {
        error: error instanceof Error ? error.message : String(error),
        type,
        channel,
        recipient,
        userId,
        couponId,
      })
      throw error
    }
  }

  async sendNotification(notificationId: string) {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      })

      if (!notification) {
        throw new Error('Notification not found')
      }

      let result
      if (notification.channel === NotificationChannel.EMAIL) {
        result = await this.sendEmail(
          notification.recipient,
          notification.subject || 'Gift Coupon Notification',
          notification.content,
          { notificationId }
        )
      } else if (notification.channel === NotificationChannel.SMS) {
        result = await this.sendSMS(
          notification.recipient,
          notification.content,
          { notificationId }
        )
      } else {
        throw new Error(`Unsupported notification channel: ${notification.channel}`)
      }

      // Update notification status
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          sentAt: new Date(),
          metadata: {
            ...(notification.metadata as object || {}),
            result,
          },
        },
      })

      logger.info('Notification sent successfully', {
        notificationId,
        channel: notification.channel,
        recipient: notification.recipient,
      })

      return result
    } catch (error) {
      // Update notification status to failed
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : String(error),
          retryCount: { increment: 1 },
        },
      })

      logger.error('Failed to send notification', {
        error: error instanceof Error ? error.message : String(error),
        notificationId,
      })
      throw error
    }
  }

  async sendCouponCreatedNotifications(couponId: string) {
    try {
      const coupon = await prisma.coupon.findUnique({
        where: { id: couponId },
        include: { sender: true },
      })

      if (!coupon) {
        throw new Error('Coupon not found')
      }

      // Notify sender
      await this.createNotification(
        NotificationType.COUPON_CREATED,
        NotificationChannel.EMAIL,
        coupon.sender.email,
        this.getCouponCreatedEmailContent(coupon),
        coupon.senderId,
        couponId,
        'Gift Coupon Created Successfully'
      )

      // Notify recipient via email
      await this.createNotification(
        NotificationType.COUPON_CREATED,
        NotificationChannel.EMAIL,
        coupon.recipientEmail,
        this.getCouponReceivedEmailContent(coupon),
        undefined,
        couponId,
        'You Received a Gift Coupon!'
      )

      // Notify recipient via SMS if phone provided
      if (coupon.recipientPhone) {
        await this.createNotification(
          NotificationType.COUPON_CREATED,
          NotificationChannel.SMS,
          coupon.recipientPhone,
          this.getCouponReceivedSMSContent(coupon),
          undefined,
          couponId
        )
      }

      logger.info('Coupon created notifications queued', {
        couponId,
        senderEmail: coupon.sender.email,
        recipientEmail: coupon.recipientEmail,
        recipientPhone: coupon.recipientPhone,
      })
    } catch (error) {
      logger.error('Failed to send coupon created notifications', {
        error: error instanceof Error ? error.message : String(error),
        couponId,
      })
      throw error
    }
  }

  async sendCouponClaimedNotification(couponId: string) {
    try {
      const coupon = await prisma.coupon.findUnique({
        where: { id: couponId },
        include: { sender: true, recipient: true },
      })

      if (!coupon || !coupon.sender) {
        throw new Error('Coupon or sender not found')
      }

      await this.createNotification(
        NotificationType.COUPON_CLAIMED,
        NotificationChannel.EMAIL,
        coupon.sender.email,
        this.getCouponClaimedEmailContent(coupon),
        coupon.senderId,
        couponId,
        'Your Gift Coupon Was Claimed!'
      )

      logger.info('Coupon claimed notification sent', {
        couponId,
        senderEmail: coupon.sender.email,
      })
    } catch (error) {
      logger.error('Failed to send coupon claimed notification', {
        error: error instanceof Error ? error.message : String(error),
        couponId,
      })
      throw error
    }
  }

  async sendCouponRedeemedNotification(couponId: string, redemptionAmount: number) {
    try {
      const coupon = await prisma.coupon.findUnique({
        where: { id: couponId },
        include: { recipient: true },
      })

      if (!coupon || !coupon.recipient) {
        throw new Error('Coupon or recipient not found')
      }

      await this.createNotification(
        NotificationType.COUPON_REDEEMED,
        NotificationChannel.EMAIL,
        coupon.recipient.email,
        this.getCouponRedeemedEmailContent(coupon, redemptionAmount),
        coupon.recipientId || undefined,
        couponId,
        'Gift Coupon Redeemed'
      )

      logger.info('Coupon redeemed notification sent', {
        couponId,
        recipientEmail: coupon.recipient.email,
        redemptionAmount,
      })
    } catch (error) {
      logger.error('Failed to send coupon redeemed notification', {
        error: error instanceof Error ? error.message : String(error),
        couponId,
        redemptionAmount,
      })
      throw error
    }
  }

  private getCouponCreatedEmailContent(coupon: any): string {
    return `
      <h2>Gift Coupon Created Successfully!</h2>
      <p>Your gift coupon has been created and sent to the recipient.</p>
      <ul>
        <li><strong>Amount:</strong> $${(coupon.amount / 100).toFixed(2)}</li>
        <li><strong>Recipient:</strong> ${coupon.recipientEmail}</li>
        <li><strong>Message:</strong> ${coupon.message || 'No message'}</li>
        <li><strong>Coupon Code:</strong> ${coupon.code}</li>
      </ul>
      <p>The recipient will receive an email and SMS with instructions to claim their gift coupon.</p>
    `
  }

  private getCouponReceivedEmailContent(coupon: any): string {
    const claimUrl = `${process.env.CLIENT_URL || 'http://localhost:3001'}/claim/${coupon.code}`
    return `
      <h2>You Received a Gift Coupon!</h2>
      <p>Someone special sent you a gift coupon.</p>
      <ul>
        <li><strong>Amount:</strong> $${(coupon.amount / 100).toFixed(2)}</li>
        <li><strong>From:</strong> ${coupon.sender.firstName || 'Anonymous'}</li>
        <li><strong>Message:</strong> ${coupon.message || 'Enjoy your gift!'}</li>
      </ul>
      <p><a href="${claimUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Claim Your Gift Coupon</a></p>
      <p>Or visit: ${claimUrl}</p>
    `
  }

  private getCouponReceivedSMSContent(coupon: any): string {
    const claimUrl = `${process.env.CLIENT_URL || 'http://localhost:3001'}/claim/${coupon.code}`
    return `You received a $${(coupon.amount / 100).toFixed(2)} gift coupon! Claim it here: ${claimUrl}`
  }

  private getCouponClaimedEmailContent(coupon: any): string {
    return `
      <h2>Your Gift Coupon Was Claimed!</h2>
      <p>Great news! Your gift coupon has been claimed by the recipient.</p>
      <ul>
        <li><strong>Amount:</strong> $${(coupon.amount / 100).toFixed(2)}</li>
        <li><strong>Recipient:</strong> ${coupon.recipientEmail}</li>
        <li><strong>Claimed At:</strong> ${coupon.claimedAt}</li>
      </ul>
      <p>The recipient can now use their gift coupon at any merchant.</p>
    `
  }

  private getCouponRedeemedEmailContent(coupon: any, redemptionAmount: number): string {
    return `
      <h2>Gift Coupon Redeemed</h2>
      <p>Your gift coupon was used for a purchase.</p>
      <ul>
        <li><strong>Amount Redeemed:</strong> $${(redemptionAmount / 100).toFixed(2)}</li>
        <li><strong>Remaining Balance:</strong> $${(coupon.balance / 100).toFixed(2)}</li>
        <li><strong>Coupon Code:</strong> ${coupon.code}</li>
      </ul>
      <p>You can continue to use the remaining balance until the coupon expires.</p>
    `
  }
}

export const notificationService = new NotificationService()
