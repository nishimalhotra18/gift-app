import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth tokens here if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 403) {
      // Handle geographic restriction
      console.error('Geographic restriction:', error.response.data.message)
    }
    return Promise.reject(error)
  }
)

// API functions
export const apiClient = {
  // Coupon operations
  createCoupon: async (data: any) => {
    const response = await api.post('/coupons', data)
    return response.data
  },

  getCoupon: async (id: string) => {
    const response = await api.get(`/coupons/${id}`)
    return response.data
  },

  getCouponByCode: async (code: string) => {
    const response = await api.get(`/coupons/claim/${code}`)
    return response.data
  },

  claimCoupon: async (code: string, data: any) => {
    const response = await api.post(`/coupons/claim/${code}`, data)
    return response.data
  },

  redeemCoupon: async (code: string, data: any) => {
    const response = await api.post(`/coupons/redeem/${code}`, data)
    return response.data
  },

  // Payment operations
  createPaymentIntent: async (data: any) => {
    const response = await api.post('/payments/create-intent', data)
    return response.data
  },

  confirmPaymentIntent: async (paymentIntentId: string) => {
    const response = await api.post(`/payments/confirm/${paymentIntentId}`)
    return response.data
  },

  // Wallet operations
  getWalletPasses: async (couponId: string) => {
    const response = await api.get(`/wallet/passes/${couponId}`)
    return response.data
  },

  generateAppleWalletPass: async (couponId: string) => {
    const response = await api.post(`/wallet/apple/${couponId}`)
    return response.data
  },

  generateGoogleWalletPass: async (couponId: string) => {
    const response = await api.post(`/wallet/google/${couponId}`)
    return response.data
  },

  // Notification operations
  getNotifications: async (userId: string, params?: any) => {
    const response = await api.get(`/notifications/user/${userId}`, { params })
    return response.data
  },

  retryNotification: async (notificationId: string) => {
    const response = await api.post(`/notifications/${notificationId}/retry`)
    return response.data
  },

  // Admin operations
  getDashboard: async () => {
    const response = await api.get('/admin/dashboard')
    return response.data
  },

  getCoupons: async (params?: any) => {
    const response = await api.get('/admin/coupons', { params })
    return response.data
  },

  getUsers: async (params?: any) => {
    const response = await api.get('/admin/users', { params })
    return response.data
  },

  getPayments: async (params?: any) => {
    const response = await api.get('/admin/payments', { params })
    return response.data
  },

  getNotifications: async (params?: any) => {
    const response = await api.get('/admin/notifications', { params })
    return response.data
  },

  retryFailedNotifications: async () => {
    const response = await api.post('/admin/notifications/retry-failed')
    return response.data
  },
}

// Export individual functions for convenience
export const {
  createCoupon,
  getCoupon,
  getCouponByCode,
  claimCoupon,
  redeemCoupon,
  createPaymentIntent,
  confirmPaymentIntent,
  getWalletPasses,
  generateAppleWalletPass,
  generateGoogleWalletPass,
  getNotifications,
  retryNotification,
  getDashboard,
  getCoupons,
  getUsers,
  getPayments,
  retryFailedNotifications,
} = apiClient

export default api
