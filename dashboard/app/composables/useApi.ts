/**
 * ==============================================================
 * Fichier :
 * useApi.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 * Gère les appels API avec le token JWT et le bon Content-Type.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
export const useApi = () => {
  const config = useRuntimeConfig()
  const baseURL: string = (config.public.apiBase as string) || 'http://localhost:8000/api'
  const authCookie = useCookie('admin_token')

  const fetchApi = <T = any>(endpoint: string, options: Record<string, any> = {}) => {
    const headers: Record<string, string> = {}

    // Auth token
    if (authCookie.value) {
      headers['Authorization'] = `Bearer ${authCookie.value}`
    }

    // Auto-set Content-Type to JSON when body is a plain object (not FormData, not string)
    const body = options.body
    if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json'
      options = { ...options, body: JSON.stringify(body) }
    }

    return $fetch<T>(endpoint, {
      baseURL,
      headers,
      ...options,
    })
  }

  const logout = () => {
    const userCookie = useCookie('user')
    authCookie.value = null
    userCookie.value = null
    return navigateTo('/login')
  }

  return { fetchApi, logout }
}
