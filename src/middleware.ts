import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'

// Domain configuration
const APP_DOMAIN = 'app.autokufe.com'
const ADMIN_DOMAIN = 'admin.autokufe.com'
const LANDING_DOMAINS = ['autokufe.com', 'www.autokufe.com']
const STAGING_DOMAIN = 'dev.autokufe.com'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'production'

  console.log('🔍 [MIDDLEWARE DEBUG]', {
    hostname,
    pathname,
    environment,
    stagingDomain: STAGING_DOMAIN,
    includesStaging: hostname.includes(STAGING_DOMAIN)
  })

  // Redirect www to non-www
  if (hostname.startsWith('www.')) {
    const newUrl = new URL(request.url)
    newUrl.host = hostname.replace('www.', '')
    console.log('↪️ [REDIRECT] www → non-www')
    return NextResponse.redirect(newUrl, 301)
  }

  // STAGING: dev.autokufe.com hosts everything (landing + dashboard)
  // Allow all routes, no redirects to other subdomains
  // SECURITY: Only users with 'dev' or 'super_admin' role can access staging
  const isStagingDomain = hostname.includes(STAGING_DOMAIN)
  if (isStagingDomain || environment === 'staging') {
    console.log('✅ [STAGING] Detected, verifying dev access')

    // Create Supabase client to check user roles
    let supabaseResponse = NextResponse.next({ request })
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

    // If logged in, verify they have dev access
    if (user) {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .is('revoked_at', null)

      const userRoles = roles?.map(r => r.role) || []
      const hasDevAccess = userRoles.includes('dev') || userRoles.includes('super_admin')

      if (!hasDevAccess) {
        console.log('❌ [STAGING] User without dev role trying to access staging')
        return new NextResponse(
          '<html><body style="font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center;"><h1>🔒 Acceso Restringido</h1><p style="color: #666;">El ambiente de staging está reservado para desarrolladores.</p><p style="color: #666;">Si necesitas acceso, contacta al equipo de desarrollo.</p><p style="margin-top: 40px;"><a href="https://app.autokufe.com" style="color: #0070f3; text-decoration: none;">← Ir a producción</a></p></body></html>',
          { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } }
        )
      }

      console.log('✅ [STAGING] Dev user verified, allowing access')
    } else {
      console.log('ℹ️ [STAGING] No session, allowing landing/login access')
    }

    // Skip subdomain logic - everything on same domain
    // Fall through to auth logic below
  } else {
    console.log('🏭 [PRODUCTION] Using subdomain logic')
    // PRODUCTION: Separate landing and app domains
    // Landing domain (autokufe.com) - only allow landing pages
    const isLandingDomain = LANDING_DOMAINS.some(d => hostname.includes(d)) && !hostname.includes('app.') && !hostname.includes('admin.')

    if (isLandingDomain) {
      // Allow landing routes (only routes that actually exist as pages)
      const landingRoutes = ['/']  // Only root landing page exists for now
      const isLandingRoute = landingRoutes.includes(pathname) || pathname.startsWith('/api/')

      // Redirect dashboard routes to app subdomain
      if (!isLandingRoute) {
        const appUrl = new URL(request.url)
        appUrl.host = APP_DOMAIN
        console.log('↪️ [REDIRECT] Landing domain → app.autokufe.com')
        return NextResponse.redirect(appUrl, 302)
      }

      // Landing pages don't need auth - just continue
      console.log('✅ [CONTINUE] Landing route allowed')
      return NextResponse.next()
    }
  }

  // Detect admin vs app access
  const isLocalhost = hostname.includes('localhost')
  const isAdminDomain = hostname.includes(ADMIN_DOMAIN)
  const isAppDomain = hostname.includes(APP_DOMAIN)
  
  // Admin routes detection
  const adminRoutes = ['/support', '/admin-jobs', '/users']
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  
  // In localhost, detect by route path. In production, detect by subdomain
  const isAdminAccess = isLocalhost ? isAdminRoute : isAdminDomain

  // Create Supabase client for checking roles
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .is('revoked_at', null)

    const userRoles = roles?.map(r => r.role) || []
    const isAdmin = roles && roles.length > 0
    const hasDevRole = userRoles.includes('dev')
    const hasSuperAdminRole = userRoles.includes('super_admin')

    // Debug logs (remove in production)
    console.log('🔍 Middleware Debug:', {
      hostname,
      pathname,
      isLocalhost,
      isAdminRoute,
      isAdminAccess,
      userId: user.id,
      userEmail: user.email,
      roles,
      rolesError,
      isAdmin,
      hasDevRole
    })

    // SECURITY: Dev role users can ONLY access staging, not production
    // This prevents dev users from accidentally using production or testing dev features there
    // super_admin can access both environments
    const isProductionApp = hostname.includes(APP_DOMAIN) && environment === 'production'
    if (hasDevRole && !hasSuperAdminRole && isProductionApp) {
      console.log('🚫 [PRODUCTION] Dev user blocked from production, redirecting to staging')

      // Sign out the user from production
      await supabase.auth.signOut()

      // Redirect to staging with message
      return new NextResponse(
        `<html>
          <body style="font-family: system-ui; max-width: 600px; margin: 100px auto; text-align: center;">
            <h1>🧪 Rol Dev Detectado</h1>
            <p style="color: #666;">
              Tu cuenta tiene rol <strong>dev</strong>, por lo que solo puedes usar el ambiente de staging.
            </p>
            <p style="color: #666;">
              Has sido deslogueado de producción automáticamente.
            </p>
            <p style="margin-top: 40px;">
              <a href="https://${STAGING_DOMAIN}" style="background: #0070f3; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
                Ir a Staging →
              </a>
            </p>
          </body>
        </html>`,
        { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } }
      )
    }

    // Admin access - only allow admin users
    if (isAdminAccess) {
      if (!isAdmin) {
        // Non-admin trying to access admin - show access denied
        console.log('❌ Non-admin trying to access admin route, showing 403')
        return new NextResponse(
          '<html><body><h1>403 - Acceso Denegado</h1><p>Esta área está restringida solo para personal autorizado de AutoKufe.</p><p><a href="/">Volver al inicio</a></p></body></html>',
          { status: 403, headers: { 'content-type': 'text/html' } }
        )
      }

      console.log('✅ Admin user accessing admin route')

      // Admin accessing admin root - redirect to support queue
      if (pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/support'
        return NextResponse.redirect(url, 302)
      }
    }

    // Regular app access - redirect root to dashboard
    // BUT: In staging, "/" shows landing page (handled by page.tsx), no redirect
    const isAppDomainProduction = hostname.includes(APP_DOMAIN)
    if (!isAdminAccess && pathname === '/' && isAppDomainProduction) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      console.log('↪️ [REDIRECT] app.autokufe.com/ → /dashboard')
      return NextResponse.redirect(url, 302)
    }
  }

  console.log('✅ [CONTINUE] Proceeding to updateSession')
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
