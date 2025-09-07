'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/Button'

interface Coupon {
  id: string
  code: string
  amount: number
  balance: number
  recipientEmail: string
  message?: string
  status: string
  createdAt: string
  expiresAt?: string
}

export function CouponList() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/coupons')
      if (!response.ok) {
        throw new Error('Failed to fetch coupons')
      }
      const data = await response.json()
      setCoupons(data.coupons || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading coupons...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={fetchCoupons} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }

  if (coupons.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4">No coupons found</div>
        <p className="text-sm text-gray-400">
          Create your first gift coupon to get started!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {coupons.map((coupon) => (
        <div key={coupon.id} className="border rounded-lg p-4 bg-white">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">Coupon #{coupon.code}</h3>
              <p className="text-sm text-gray-600">{coupon.recipientEmail}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              coupon.status === 'ACTIVE' 
                ? 'bg-green-100 text-green-800' 
                : coupon.status === 'CLAIMED'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {coupon.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Amount:</span>
              <span className="ml-1 font-medium">${(coupon.amount / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Balance:</span>
              <span className="ml-1 font-medium">${(coupon.balance / 100).toFixed(2)}</span>
            </div>
          </div>
          
          {coupon.message && (
            <div className="mt-2">
              <span className="text-gray-500 text-sm">Message:</span>
              <p className="text-sm text-gray-700 mt-1">{coupon.message}</p>
            </div>
          )}
          
          <div className="mt-2 text-xs text-gray-400">
            Created: {new Date(coupon.createdAt).toLocaleDateString()}
            {coupon.expiresAt && (
              <span className="ml-2">
                Expires: {new Date(coupon.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
