export const getMediaUrl = (url: string | null | undefined): string => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  const config = useRuntimeConfig()
  const apiBase = (config.public.apiUrl || config.public.apiBase || '') as string
  const baseUrl = apiBase.replace(/\/api\/?$/, '')
  const path = url.startsWith('/') ? url : `/${url}`
  return `${baseUrl}${path}`
}
