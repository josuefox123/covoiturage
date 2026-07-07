<!--
==========================================================
Fichier :
login.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="min-h-screen bg-background flex">
    <!-- Left panel - decorative -->
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-dark via-primary to-secondary relative overflow-hidden flex-col items-center justify-center p-12">
      <!-- Background circles -->
      <div class="absolute top-[-80px] left-[-80px] w-96 h-96 rounded-full bg-white/5"></div>
      <div class="absolute bottom-[-60px] right-[-60px] w-80 h-80 rounded-full bg-white/5"></div>
      <div class="absolute top-1/2 left-1/4 w-48 h-48 rounded-full bg-white/5"></div>

      <!-- Content -->
      <div class="relative z-10 text-white text-center max-w-md">
        <div class="flex items-center justify-center mx-auto mb-8">
          <img src="/images/logozemy.png" alt="Zemy Logo" class="h-16 object-contain" style="filter: brightness(0) invert(1);">
        </div>
        <h1 class="text-4xl font-extrabold mb-4 leading-tight">
          <span class="text-white/70">Administration</span>
        </h1>
        <p class="text-white/60 text-lg leading-relaxed">
          Gérez vos utilisateurs, trajets et réservations depuis un panneau centralisé et sécurisé.
        </p>

        <!-- Stats -->
        <div class="mt-10 grid grid-cols-3 gap-4">
          <div class="bg-white/10 backdrop-blur rounded-xl p-4">
            <p class="text-2xl font-bold">2.4K</p>
            <p class="text-white/60 text-xs mt-1">Utilisateurs</p>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-xl p-4">
            <p class="text-2xl font-bold">845</p>
            <p class="text-white/60 text-xs mt-1">Trajets</p>
          </div>
          <div class="bg-white/10 backdrop-blur rounded-xl p-4">
            <p class="text-2xl font-bold">99%</p>
            <p class="text-white/60 text-xs mt-1">Disponibilité</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel - login form -->
    <div class="flex-1 flex flex-col items-center justify-center p-8">
      <!-- Mobile logo -->
      <div class="lg:hidden flex items-center mb-8 space-x-3">
        <img src="/images/logozemy.png" alt="Zemy Logo" class="h-10 object-contain">
        <span class="text-xl font-bold text-text">Admin</span>
      </div>

      <div class="w-full max-w-md">
        <!-- Header -->
        <div class="mb-8">
          <h2 class="text-3xl font-extrabold text-text">Connexion</h2>
          <p class="text-textLight mt-2">Entrez vos identifiants pour accéder au tableau de bord.</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="space-y-5">
          <!-- Identifier -->
          <div>
            <label class="block text-sm font-medium text-text mb-1.5">Identifiant</label>
            <div class="relative">
              <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted">
                <Icon name="ph:user" class="w-5 h-5" />
              </div>
              <input
                v-model="form.identifier"
                type="text"
                placeholder="Téléphone, email ou username"
                required
                autocomplete="username"
                class="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary text-sm transition-all placeholder:text-textMuted"
              />
            </div>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm font-medium text-text mb-1.5">Mot de passe</label>
            <div class="relative">
              <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted">
                <Icon name="ph:lock-simple" class="w-5 h-5" />
              </div>
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Votre mot de passe"
                required
                autocomplete="current-password"
                class="w-full pl-11 pr-12 py-3 rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary text-sm transition-all placeholder:text-textMuted"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-textMuted hover:text-text transition-colors"
              >
                <Icon :name="showPassword ? 'ph:eye-slash' : 'ph:eye'" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Error message -->
          <Transition name="fade">
            <div
              v-if="errorMsg"
              class="flex items-center space-x-2 p-3.5 bg-error/10 border border-error/20 rounded-xl text-sm text-error"
            >
              <Icon name="ph:warning-circle-fill" class="flex-shrink-0 w-5 h-5" />
              <span>{{ errorMsg }}</span>
            </div>
          </Transition>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-3 px-4 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center space-x-2 shadow-lg shadow-primary/30"
          >
            <Icon v-if="loading" name="ph:spinner-gap" class="w-5 h-5 animate-spin" />
            <Icon v-else name="ph:sign-in" class="w-5 h-5" />
            <span>{{ loading ? 'Connexion...' : 'Se connecter' }}</span>
          </button>
        </form>

        <!-- Footer note -->
        <p class="text-center text-xs text-textMuted mt-8">
          Accès réservé aux administrateurs de la plateforme.<br />
          <span class="text-primary">Zemy &copy; {{ new Date().getFullYear() }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

definePageMeta({
  layout: 'auth',
})

const router = useRouter()
const authCookie = useCookie('admin_token', {
  maxAge: 60 * 60 * 24 * 7, // 7 jours
  sameSite: 'lax',
})

const form = reactive({ identifier: '', password: '' })
const loading = ref(false)
const errorMsg = ref('')
const showPassword = ref(false)

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true

  try {
    const { fetchApi } = useApi()
    const res = await fetchApi<any>(
      '/auth/login/',
      {
        method: 'POST',
        body: { identifier: form.identifier, password: form.password },
      }
    )

    // Vérifier que l'utilisateur est bien staff/admin
    if (!res.user?.is_staff && !res.user?.is_superuser) {
      errorMsg.value = 'Accès refusé. Vous n\'avez pas les droits administrateur.'
      return
    }

    authCookie.value = res.access
    
    const userCookie = useCookie('user', {
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })
    userCookie.value = res.user

    await router.push('/dashboard')
  } catch (e: any) {
    const data = e?.data
    if (data?.error) {
      errorMsg.value = data.error
    } else {
      errorMsg.value = 'Identifiants invalides. Veuillez réessayer.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
