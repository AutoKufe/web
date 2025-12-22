import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

// Domain configuration
const APP_DOMAIN = 'app.autokufe.com'
const ADMIN_DOMAIN = 'admin.autokufe.com'
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
  const isLandingDomain = LANDING_DOMAINS.some(d => hostname.includes(d)) && !hostname.includes('app.') && !hostname.includes('admin.')

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

  // Detect admin vs app domain
  const isAdminDomain = hostname.includes(ADMIN_DOMAIN) || hostname.includes('localhost:3001')
  const isAppDomain = hostname.includes(APP_DOMAIN) || hostname.includes('localhost:3000')

  // Create Supabase client for checking roles
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check if user has admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .is('revoked_at', null)

    const isAdmin = roles && roles.length > 0

    // Admin domain - only allow admin users
    if (isAdminDomain) {
      if (!isAdmin) {
        // Non-admin trying to access admin - redirect to app
        const appUrl = new URL(request.url)
        appUrl.host = APP_DOMAIN
        appUrl.pathname = '/dashboard'
        return NextResponse.redirect(appUrl, 302)
      }
      // Admin accessing admin domain - redirect root to support queue
      if (pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/support'
        return NextResponse.redirect(url, 302)
      }
    }

    // App domain - admins should use admin domain for admin tasks
    if (isAppDomain) {
      // Allow normal users to use app domain freely
      // Redirect root to dashboard
      if (pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url, 302)
      }
    }
  }

  // Continue with session management
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
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
