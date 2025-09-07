'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { Gift, CreditCard, Mail, User } from 'lucide-react'
import { Button } from './ui/Button'

interface CreateCouponFormData {
  amount: number
  recipientEmail: string
  recipientPhone?: string
  title: string
  message?: string
  senderEmail: string
  senderName?: string
}

export function CreateCouponForm() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [fee, setFee] = useState(0)
  const [total, setTotal] = useState(0)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateCouponFormData>()

  const amount = watch('amount', 0)

  // Calculate fee and total when amount changes
  useEffect(() => {
    if (amount >= 25) { // Minimum $25.00
      const calculatedFee = Math.round(amount * 0.04) // 4% fee
      const calculatedTotal = amount + calculatedFee
      setFee(calculatedFee)
      setTotal(calculatedTotal)
    } else {
      setFee(0)
      setTotal(0)
    }
  }, [amount])

  const createCouponMutation = useMutation({
    mutationFn: async (data: CreateCouponFormData) => {
      const response = await fetch('/api/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          amount: data.amount * 100, // Convert to cents
        }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create coupon')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      toast.success('Coupon created successfully!')
      // Reset form
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create coupon')
    },
  })

  const onSubmit = async (data: CreateCouponFormData) => {
    setIsProcessing(true)
    try {
      await createCouponMutation.mutateAsync(data)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Amount Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-blue-600" />
          <label className="text-base font-medium">Gift Amount</label>
        </div>
        
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
            $
          </span>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="25.00"
            placeholder="25.00"
            className="pl-8 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            {...register('amount', {
              required: 'Amount is required',
              min: { value: 25, message: 'Minimum amount is $25.00' },
            })}
          />
        </div>
        
        {errors.amount && (
          <p className="text-sm text-red-600">{errors.amount.message}</p>
        )}

        {/* Fee and Total Display */}
        {amount >= 25 && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Gift Amount:</span>
              <span>${amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Processing Fee (4%):</span>
              <span>${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Recipient Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <label className="text-base font-medium">Recipient Details</label>
        </div>

        <div>
          <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
          <input
            id="recipientEmail"
            type="email"
            placeholder="recipient@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            {...register('recipientEmail', {
              required: 'Recipient email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />
          {errors.recipientEmail && (
            <p className="text-sm text-red-600">{errors.recipientEmail.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="recipientPhone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
          <input
            id="recipientPhone"
            type="tel"
            placeholder="+1 (555) 123-4567"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            {...register('recipientPhone')}
          />
        </div>
      </div>

      {/* Sender Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-600" />
          <label className="text-base font-medium">Your Details</label>
        </div>

        <div>
          <label htmlFor="senderEmail" className="block text-sm font-medium text-gray-700 mb-1">Your Email *</label>
          <input
            id="senderEmail"
            type="email"
            placeholder="your@email.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            {...register('senderEmail', {
              required: 'Your email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address',
              },
            })}
          />
          {errors.senderEmail && (
            <p className="text-sm text-red-600">{errors.senderEmail.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="senderName" className="block text-sm font-medium text-gray-700 mb-1">Your Name (Optional)</label>
          <input
            id="senderName"
            type="text"
            placeholder="John Doe"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            {...register('senderName')}
          />
        </div>
      </div>

      {/* Coupon Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-blue-600" />
          <label className="text-base font-medium">Coupon Details</label>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Coupon Title *</label>
          <input
            id="title"
            type="text"
            placeholder="Coffee Gift"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            {...register('title', {
              required: 'Coupon title is required',
              maxLength: { value: 255, message: 'Title must be less than 255 characters' },
            })}
          />
          {errors.title && (
            <p className="text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Personal Message (Optional)</label>
          <textarea
            id="message"
            placeholder="Enjoy your gift! Happy birthday!"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            {...register('message', {
              maxLength: { value: 500, message: 'Message must be less than 500 characters' },
            })}
          />
          {errors.message && (
            <p className="text-sm text-red-600">{errors.message.message}</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isProcessing || amount < 25}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Creating Coupon...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Create Coupon - ${total > 0 ? total.toFixed(2) : '0.00'}
          </>
        )}
      </Button>

      {/* US Only Notice */}
      <div className="text-center">
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          US Only Service
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This service is only available for use within the United States
        </p>
      </div>
    </form>
  )
}