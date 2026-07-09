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
  const baseURL: string = (config.public.apiBase as string) || 'https://zemy.erika-app.com/api'
  const authCookie = useCookie('admin_token')

  const fetchApi = <T = any>(endpoint: string, options: Record<string, any> = {}) => {
    const headers: Record<string, string> = {
      // Merge any headers passed in options first, then override with our own
      ...(options.headers || {}),
    }

    // Auth token (do not send for auth routes, or if token is placeholder text)
    const isAuthRoute = endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/verify-code')
    if (authCookie.value && authCookie.value !== 'undefined' && authCookie.value !== 'null' && !isAuthRoute) {
      headers['Authorization'] = `Bearer ${authCookie.value}`
    }

    // Auto-set Content-Type to JSON when body is a plain object (not FormData, not string)
    const body = options.body
    let finalBody = body
    if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json'
      finalBody = JSON.stringify(body)
    }

    // Destructure to avoid passing options.headers again (we already merged it)
    const { headers: _h, body: _b, ...restOptions } = options

    return $fetch<T>(endpoint, {
      baseURL,
      headers,
      body: finalBody,
      ...restOptions,
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
