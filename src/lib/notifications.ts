/**
 * Web Push Notifications Utility Library
 * Handles browser push notification subscription and permission management
 */

import { apiClient } from './api/client'

/**
 * Check if browser supports push notifications
 */
export function isNotificationsSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationsSupported()) {
    return 'unsupported'
  }
  return Notification.permission
}

/**
 * Request notification permission from user
 * Returns true if permission was granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported()) {
    console.warn('Push notifications not supported in this browser')
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch (error) {
    console.error('Error requesting notification permission:', error)
    return false
  }
}

/**
 * Register the service worker for push notifications
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isNotificationsSupported()) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    console.log('Service Worker registered:', registration.scope)
    return registration
  } catch (error) {
    console.error('Service Worker registration failed:', error)
    return null
  }
}

/**
 * Convert URL-safe base64 to Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

/**
 * Subscribe to push notifications
 * Returns the subscription endpoint or null if failed
 */
export async function subscribeToPush(): Promise<{ success: boolean; error?: string }> {
  if (!isNotificationsSupported()) {
    return { success: false, error: 'Push notifications not supported' }
  }

  // Request permission first
  const hasPermission = await requestNotificationPermission()
  if (!hasPermission) {
    return { success: false, error: 'Permission denied' }
  }

  try {
    // Get or register service worker
    let registration = await navigator.serviceWorker.ready

    if (!registration) {
      registration = await registerServiceWorker() as ServiceWorkerRegistration
      if (!registration) {
        return { success: false, error: 'Service Worker registration failed' }
      }
    }

    // Get VAPID public key from backend
    const vapidResponse = await apiClient.getVapidPublicKey()
    if (vapidResponse.error || !vapidResponse.vapid_public_key) {
      return { success: false, error: 'Failed to get VAPID key' }
    }

    const vapidPublicKey = vapidResponse.vapid_public_key as string

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    })

    // Extract keys from subscription
    const subscriptionJson = subscription.toJSON()
    const endpoint = subscriptionJson.endpoint || ''
    const p256dhKey = subscriptionJson.keys?.p256dh || ''
    const authKey = subscriptionJson.keys?.auth || ''

    // Send subscription to backend
    const response = await apiClient.subscribeToNotifications({
      endpoint,
      p256dh_key: p256dhKey,
      auth_key: authKey,
      device_name: getDeviceName()
    })

    if (response.error) {
      return { success: false, error: response.error }
    }

    return { success: true }

  } catch (error) {
    console.error('Error subscribing to push:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Unsubscribe from push notifications (soft-disable)
 * Keeps browser subscription intact for easy reactivation
 */
export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  if (!isNotificationsSupported()) {
    return { success: false, error: 'Push notifications not supported' }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      const endpoint = subscription.endpoint

      // Deactivate in backend (soft-disable, keeps browser subscription)
      const response = await apiClient.unsubscribeFromNotifications({ endpoint })

      if (response.error) {
        return { success: false, error: response.error }
      }
    }

    return { success: true }

  } catch (error) {
    console.error('Error unsubscribing from push:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if user is currently subscribed to push notifications
 */
export async function isSubscribedToPush(): Promise<boolean> {
  if (!isNotificationsSupported()) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

/**
 * Generate a simple device name based on browser and platform
 */
function getDeviceName(): string {
  const ua = navigator.userAgent

  let browser = 'Browser'
  if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('Edge')) browser = 'Edge'

  let platform = 'Desktop'
  if (ua.includes('Android')) platform = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) platform = 'iOS'
  else if (ua.includes('Windows')) platform = 'Windows'
  else if (ua.includes('Mac')) platform = 'Mac'
  else if (ua.includes('Linux')) platform = 'Linux'

  return `${browser} en ${platform}`
}
