import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/landing/LandingPage'

export default async function Home() {
  const headersList = await headers()
  const hostname = headersList.get('host') || ''

  // Landing domain - show landing page
  const isLandingDomain = hostname.includes('autokufe.com') && !hostname.includes('app.')

  if (isLandingDomain) {
    return <LandingPage />
  }

  // App domain - redirect based on auth status
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
