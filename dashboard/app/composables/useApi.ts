/**
 * ==============================================================
 * Fichier :
 * useApi.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
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
    if (authCookie.value) {
      headers['Authorization'] = `Bearer ${authCookie.value}`
    }

    return $fetch<T>(endpoint, {
      baseURL,
      headers,
      ...options,
    })
  }

  const logout = () => {
    authCookie.value = null
    return navigateTo('/login')
  }

  return { fetchApi, logout }
}
