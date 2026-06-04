export const useApi = () => {
  const config = useRuntimeConfig()
  const baseURL: string = (config.public.apiBase as string) || 'http://localhost:8000/api'

  const fetchApi = <T = any>(endpoint: string, options: Record<string, any> = {}) => {
    return $fetch<T>(endpoint, {
      baseURL,
      ...options,
    })
  }

  return { fetchApi }
}
