'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Briefcase } from 'lucide-react'

export default function AdminJobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Todos los Jobs</h1>
        <p className="text-gray-600 mt-2">
          Vista global de todos los jobs del sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs del Sistema</CardTitle>
          <CardDescription>
            Próximamente: Lista de todos los jobs con filtros avanzados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Briefcase className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Funcionalidad en desarrollo</p>
            <p className="text-sm text-gray-500 mt-2">
              Aquí podrás ver todos los jobs de todos los usuarios con filtros y búsqueda avanzada
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
