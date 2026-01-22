import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/landing/LandingPage'

export default async function Home() {
  const headersList = await headers()
  const hostname = headersList.get('host') || ''
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'production'

  console.log('🔍 [PAGE.TSX DEBUG]', {
    hostname,
    environment,
    includesAutokufe: hostname.includes('autokufe.com'),
    includesApp: hostname.includes('app.'),
    isLandingDomain: hostname.includes('autokufe.com') && !hostname.includes('app.')
  })

  // STAGING (dev.autokufe.com):
  // - "/" → Always show landing page
  // - User clicks login/register → goes to /login or /register on same domain
  if (environment === 'staging') {
    console.log('✅ [PAGE.TSX] Showing landing (staging mode)')
    return <LandingPage />
  }

  // PRODUCTION:
  // Landing domain (autokufe.com) - show landing page
  const isLandingDomain = hostname.includes('autokufe.com') && !hostname.includes('app.')

  if (isLandingDomain) {
    console.log('✅ [PAGE.TSX] Showing landing (landing domain)')
    return <LandingPage />
  }

  console.log('↪️ [PAGE.TSX] Will redirect to login (not landing domain)')

  // App domain (app.autokufe.com) - redirect based on auth status
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
