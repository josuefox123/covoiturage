// Middleware de protection des routes du dashboard admin
// Redirige vers /login si le cookie de token n'est pas présent

export default defineNuxtRouteMiddleware((to) => {
  // La page de login est accessible sans authentification
  if (to.path === '/login') return

  const token = useCookie('admin_token')

  if (!token.value) {
    return navigateTo('/login')
  }
})
