import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export const geoRestriction = (req: Request, res: Response, next: NextFunction) => {
  // Simple IP-based geographic restriction
  // In production, you would use a proper geolocation service
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '127.0.0.1'
  
  // Mock US-only restriction - in production, use a geolocation service
  const allowedCountries = process.env.ALLOWED_COUNTRIES?.split(',') || ['US']
  
  // For development/testing, allow localhost and common development IPs
  if (process.env.NODE_ENV === 'development') {
    const devIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']
    if (devIPs.includes(clientIP)) {
      return next()
    }
  }
  
  // Mock country detection - in production, use a service like MaxMind
  const mockCountry = getMockCountryFromIP(clientIP)
  
  if (!allowedCountries.includes(mockCountry)) {
    logger.warn('Geographic restriction triggered', {
      clientIP,
      detectedCountry: mockCountry,
      allowedCountries,
      path: req.path,
    })
    
    return res.status(403).json({
      error: 'Geographic Restriction',
      message: 'This service is only available in the United States',
      code: 'GEO_RESTRICTED',
    })
  }
  
  next()
}

// Mock function to simulate country detection from IP
// In production, replace with actual geolocation service
function getMockCountryFromIP(ip: string): string {
  // Simple mock logic for demonstration
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return 'US' // Private IP ranges - assume US
  }
  
  // Mock some IP ranges for testing
  const mockRanges: { [key: string]: string } = {
    '8.8.8.8': 'US',      // Google DNS
    '1.1.1.1': 'US',      // Cloudflare DNS
    '208.67.222.222': 'US', // OpenDNS
  }
  
  return mockRanges[ip] || 'US' // Default to US for demo purposes
}
