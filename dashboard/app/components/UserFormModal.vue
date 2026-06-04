<template>
  <!-- Backdrop -->
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>

      <div class="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden">
        <!-- Blue top bar -->
        <div class="h-1.5 bg-gradient-to-r from-primary to-secondary w-full"></div>

        <div class="p-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon :name="isEditing ? 'ph:pencil-simple-fill' : 'ph:user-plus-fill'" class="w-5 h-5 text-primary" />
              </div>
              <h3 class="text-lg font-bold text-text">
                {{ isEditing ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur' }}
              </h3>
            </div>
            <button @click="$emit('close')" class="text-textMuted hover:text-text transition-colors">
              <Icon name="ph:x" class="w-5 h-5" />
            </button>
          </div>

          <!-- Form -->
          <form @submit.prevent="submit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-text mb-1">Nom complet</label>
              <input
                v-model="form.full_name"
                type="text"
                placeholder="Ex: Jean Dupont"
                class="w-full px-4 py-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-text mb-1">
                Téléphone <span class="text-error">*</span>
              </label>
              <input
                v-model="form.phone"
                type="tel"
                placeholder="+229 00000000"
                required
                class="w-full px-4 py-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-text mb-1">Email</label>
              <input
                v-model="form.email"
                type="email"
                placeholder="exemple@email.com"
                class="w-full px-4 py-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
              />
            </div>

            <div v-if="!isEditing">
              <label class="block text-sm font-medium text-text mb-1">
                Mot de passe <span class="text-error">*</span>
              </label>
              <div class="relative">
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Minimum 8 caractères"
                  required
                  class="w-full px-4 py-2.5 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm pr-10 transition-all"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-text"
                >
                  <Icon :name="showPassword ? 'ph:eye-slash' : 'ph:eye'" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-text mb-2">Statut</label>
              <div class="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40">
                <span class="text-sm text-textLight">Compte vérifié</span>
                <button
                  type="button"
                  @click="form.is_verified = !form.is_verified"
                  class="relative w-11 h-6 rounded-full transition-colors duration-200"
                  :class="form.is_verified ? 'bg-success' : 'bg-border'"
                >
                  <span
                    class="block w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-transform duration-200"
                    :class="form.is_verified ? 'translate-x-6' : 'translate-x-1'"
                  ></span>
                </button>
              </div>
            </div>

            <!-- Error message -->
            <div v-if="error" class="flex items-center space-x-2 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error">
              <Icon name="ph:warning-circle" class="flex-shrink-0" />
              <span>{{ error }}</span>
            </div>

            <!-- Actions -->
            <div class="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                @click="$emit('close')"
                class="px-4 py-2 text-sm font-medium text-textLight border border-border rounded-lg hover:bg-background transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="loading"
                class="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60 flex items-center space-x-2"
              >
                <Icon v-if="loading" name="ph:spinner-gap" class="w-4 h-4 animate-spin" />
                <span>{{ isEditing ? 'Mettre à jour' : 'Créer l\'utilisateur' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps<{
  show: boolean
  user?: any
}>()

const emit = defineEmits<{
  close: []
  saved: [user: any]
}>()

const { fetchApi } = useApi()

const isEditing = computed(() => !!props.user)
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

const defaultForm = () => ({
  full_name: '',
  phone: '',
  email: '',
  password: '',
  is_verified: false,
})

const form = ref(defaultForm())

watch(() => props.user, (u) => {
  if (u) {
    form.value = {
      full_name: u.full_name || '',
      phone: u.phone || '',
      email: u.email || '',
      password: '',
      is_verified: u.is_verified || false,
    }
  } else {
    form.value = defaultForm()
  }
}, { immediate: true })

const submit = async () => {
  error.value = ''
  loading.value = true

  try {
    const payload: any = {
      full_name: form.value.full_name,
      phone: form.value.phone,
      email: form.value.email || undefined,
      is_verified: form.value.is_verified,
    }
    if (!isEditing.value && form.value.password) {
      payload.password = form.value.password
    }

    let saved
    if (isEditing.value) {
      saved = await fetchApi(`/users/${props.user.id}/`, {
        method: 'PATCH',
        body: payload,
      })
    } else {
      saved = await fetchApi('/users/', {
        method: 'POST',
        body: payload,
      })
    }

    emit('saved', saved)
  } catch (e: any) {
    const data = e?.data || e?.response?.data
    if (data) {
      const firstKey = Object.keys(data)[0]
      error.value = Array.isArray(data[firstKey]) ? data[firstKey][0] : String(data[firstKey])
    } else {
      error.value = 'Une erreur est survenue. Vérifiez les informations.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
