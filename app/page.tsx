import { Suspense } from 'react'
import { CreateCouponForm } from '../components/CreateCouponForm'
import { CouponList } from '../components/CouponList'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Gift Coupon App
            </h1>
            <p className="text-xl text-gray-600">
              Create, send, and manage digital gift coupons with wallet integration
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Create New Coupon</h2>
                  <p className="card-description">
                    Create a gift coupon and send it to someone special
                  </p>
                </div>
                <div className="card-content">
                  <Suspense fallback={<LoadingSpinner />}>
                    <CreateCouponForm />
                  </Suspense>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Recent Coupons</h2>
                  <p className="card-description">
                    View and manage your recent gift coupons
                  </p>
                </div>
                <div className="card-content">
                  <Suspense fallback={<LoadingSpinner />}>
                    <CouponList />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="alert alert-default">
              <div className="flex items-center justify-center gap-2">
                <span className="font-medium">US Only:</span>
                <span>This service is only available for use within the United States.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
