<template>
  <div>
    <!-- Toast Notification -->
    <ToastNotification
      :show="toast.show"
      :type="toast.type"
      :title="toast.title"
      :message="toast.message"
      @close="toast.show = false"
    />

    <h1 class="text-2xl font-bold text-text mb-8">Mon Profil</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Informations Personnelles -->
      <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div class="px-6 py-4 border-b border-border">
          <h2 class="text-lg font-semibold text-text">Informations Personnelles</h2>
          <p class="text-sm text-textLight mt-1">Mettez à jour vos informations de base.</p>
        </div>
        <form @submit.prevent="updateProfile" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-text mb-1">Nom complet</label>
            <input v-model="profileForm.full_name" type="text" class="w-full px-4 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-background text-text transition-all" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Email</label>
            <input v-model="profileForm.email" type="email" class="w-full px-4 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-background text-text transition-all" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Téléphone</label>
            <input v-model="profileForm.phone" type="text" class="w-full px-4 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-background text-text transition-all" />
          </div>
          <div class="pt-4 flex justify-end">
            <button type="submit" :disabled="profileLoading" class="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center">
              <Icon v-if="profileLoading" name="ph:spinner-gap" class="w-4 h-4 mr-2 animate-spin" />
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      <!-- Sécurité & Mot de passe -->
      <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div class="px-6 py-4 border-b border-border">
          <h2 class="text-lg font-semibold text-text">Sécurité</h2>
          <p class="text-sm text-textLight mt-1">Modifiez votre mot de passe de connexion.</p>
        </div>
        <form @submit.prevent="changePassword" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-text mb-1">Ancien mot de passe</label>
            <input v-model="passwordForm.old_password" type="password" required class="w-full px-4 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-background text-text transition-all" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Nouveau mot de passe</label>
            <input v-model="passwordForm.new_password" type="password" required class="w-full px-4 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-background text-text transition-all" />
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">Confirmer le nouveau mot de passe</label>
            <input v-model="passwordForm.confirm_password" type="password" required class="w-full px-4 py-2.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-background text-text transition-all" />
          </div>
          <div class="pt-4 flex justify-end">
            <button type="submit" :disabled="passwordLoading" class="px-5 py-2.5 bg-secondary text-white text-sm font-medium rounded-xl hover:bg-secondary-dark transition-colors disabled:opacity-50 flex items-center">
              <Icon v-if="passwordLoading" name="ph:spinner-gap" class="w-4 h-4 mr-2 animate-spin" />
              Mettre à jour
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'

const { fetchApi } = useApi()
const authUser = useCookie<any>('user')

// State
const profileLoading = ref(false)
const passwordLoading = ref(false)

const profileForm = reactive({
  full_name: '',
  email: '',
  phone: ''
})

const passwordForm = reactive({
  old_password: '',
  new_password: '',
  confirm_password: ''
})

// Toast
const toast = reactive({
  show: false,
  type: 'success' as 'success' | 'error' | 'warning' | 'info',
  title: '',
  message: ''
})

function showToast(type: typeof toast.type, title: string, message = '') {
  toast.type = type
  toast.title = title
  toast.message = message
  toast.show = true
}

onMounted(() => {
  if (authUser.value) {
    profileForm.full_name = authUser.value.full_name || ''
    profileForm.email = authUser.value.email || ''
    profileForm.phone = authUser.value.phone || ''
  }
})

async function updateProfile() {
  profileLoading.value = true
  try {
    const data = await fetchApi('/auth/update-profile/', {
      method: 'PUT',
      body: {
        full_name: profileForm.full_name,
        email: profileForm.email,
        phone: profileForm.phone
      }
    })
    authUser.value = data.user
    showToast('success', 'Profil mis à jour', 'Vos informations ont été enregistrées.')
  } catch (err: any) {
    showToast('error', 'Erreur', err.data?.error || 'Impossible de mettre à jour le profil.')
  } finally {
    profileLoading.value = false
  }
}

async function changePassword() {
  if (passwordForm.new_password !== passwordForm.confirm_password) {
    showToast('error', 'Erreur', 'Les nouveaux mots de passe ne correspondent pas.')
    return
  }

  passwordLoading.value = true
  try {
    await fetchApi('/auth/change-password/', {
      method: 'POST',
      body: {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password
      }
    })
    showToast('success', 'Mot de passe modifié', 'Votre mot de passe a été mis à jour avec succès.')
    passwordForm.old_password = ''
    passwordForm.new_password = ''
    passwordForm.confirm_password = ''
  } catch (err: any) {
    showToast('error', 'Erreur', err.data?.error || 'Impossible de modifier le mot de passe.')
  } finally {
    passwordLoading.value = false
  }
}
</script>
