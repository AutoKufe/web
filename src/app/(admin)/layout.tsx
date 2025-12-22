'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserRoles } from '@/lib/hooks/use-user-roles'
import Link from 'next/link'
import { Shield, Users, Briefcase, HeadsetIcon } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isAdmin, loading } = useUserRoles()

  useEffect(() => {
    if (!loading && !isAdmin) {
      // Redirect non-admins to app domain
      window.location.href = 'https://app.autokufe.com/dashboard'
    }
  }, [isAdmin, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-red-600 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              <h1 className="text-xl font-bold">AutoKufe Admin Panel</h1>
            </div>
            <nav className="flex gap-6">
              <Link
                href="/support"
                className="flex items-center gap-2 hover:text-red-100 transition-colors"
              >
                <HeadsetIcon className="h-4 w-4" />
                Soporte
              </Link>
              <Link
                href="/jobs"
                className="flex items-center gap-2 hover:text-red-100 transition-colors"
              >
                <Briefcase className="h-4 w-4" />
                Jobs
              </Link>
              <Link
                href="/users"
                className="flex items-center gap-2 hover:text-red-100 transition-colors"
              >
                <Users className="h-4 w-4" />
                Usuarios
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
