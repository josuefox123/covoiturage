// Middleware de protection des routes du dashboard admin
// Redirige vers /login si le cookie de token n'est pas présent

export default defineNuxtRouteMiddleware((to) => {
  // Les pages publiques sont accessibles sans authentification
  const publicRoutes = ['/', '/about', '/download', '/contact', '/login']
  if (publicRoutes.includes(to.path)) return

  const token = useCookie('admin_token')

  if (!token.value) {
    return navigateTo('/login')
  }
})
