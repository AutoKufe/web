import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { toast } from 'sonner'

/**
 * Hook to detect and handle expired temp IDs in URL parameters.
 *
 * When a temp ID parameter exists but the corresponding item is not found
 * in the loaded data, this hook will:
 * 1. Show a toast message to the user
 * 2. Redirect to the same page without the expired parameter
 *
 * @param paramName - The URL parameter name to check (e.g., 'entity', 'job')
 * @param items - Array of items to search in (must have 'id' property)
 * @param isLoading - Whether the items are still loading
 */
export function useExpiredTempId<T extends { id: string }>(
  paramName: string,
  items: T[],
  isLoading: boolean
) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const hasChecked = useRef(false)

  const paramValue = searchParams.get(paramName)

  useEffect(() => {
    // Only check once after loading completes
    if (isLoading || hasChecked.current || !paramValue) {
      return
    }

    // Check if the ID exists in the loaded items
    const itemExists = items.some(item => item.id === paramValue)

    if (!itemExists && items.length > 0) {
      hasChecked.current = true

      // Show toast message
      toast.error('Enlace expirado', {
        description: 'El enlace que seguiste ha expirado. Por favor selecciona nuevamente.',
        duration: 5000,
      })

      // Remove the expired parameter from URL
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete(paramName)

      const newUrl = newSearchParams.toString()
        ? `${pathname}?${newSearchParams.toString()}`
        : pathname

      router.replace(newUrl)
    }
  }, [paramValue, items, isLoading, paramName, pathname, router, searchParams])

  // Reset check flag when param changes
  useEffect(() => {
    hasChecked.current = false
  }, [paramValue])

  return {
    paramValue,
    isExpired: !isLoading && paramValue && items.length > 0 && !items.some(item => item.id === paramValue)
  }
}
