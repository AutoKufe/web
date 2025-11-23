import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Domain configuration
const APP_DOMAIN = 'app.autokufe.com'
const LANDING_DOMAINS = ['autokufe.com', 'www.autokufe.com']

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // Redirect www to non-www
  if (hostname.startsWith('www.')) {
    const newUrl = new URL(request.url)
    newUrl.host = hostname.replace('www.', '')
    return NextResponse.redirect(newUrl, 301)
  }

  // Landing domain (autokufe.com) - only allow landing pages
  const isLandingDomain = LANDING_DOMAINS.some(d => hostname.includes(d)) && !hostname.includes('app.')

  if (isLandingDomain) {
    // Allow landing routes
    const landingRoutes = ['/', '/pricing', '/about', '/contact', '/terms', '/privacy']
    const isLandingRoute = landingRoutes.includes(pathname) || pathname.startsWith('/api/')

    // Redirect dashboard routes to app subdomain
    if (!isLandingRoute) {
      const appUrl = new URL(request.url)
      appUrl.host = APP_DOMAIN
      return NextResponse.redirect(appUrl, 302)
    }

    // Landing pages don't need auth - just continue
    return NextResponse.next()
  }

  // App domain (app.autokufe.com) - full dashboard functionality
  // Redirect root to dashboard
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url, 302)
  }

  // Continue with session management for app domain
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
