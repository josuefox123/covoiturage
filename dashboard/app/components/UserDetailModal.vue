<!--
==========================================================
Fichier :
UserDetailModal.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="$emit('close')"></div>

      <div class="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg z-10 max-h-[90vh] flex flex-col overflow-hidden my-auto">
        <div class="h-1.5 bg-gradient-to-r from-primary to-secondary w-full"></div>

        <div class="p-4 sm:p-6 overflow-y-auto">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="ph:user-fill" class="w-5 h-5 text-primary" />
              </div>
              <h3 class="text-lg font-bold text-text">Détails de l'utilisateur</h3>
            </div>
            <button @click="$emit('close')" class="text-textMuted hover:text-text transition-colors">
              <Icon name="ph:x" class="w-5 h-5" />
            </button>
          </div>

          <div v-if="user" class="space-y-5">
            <!-- Avatar + Name -->
            <div class="flex items-center space-x-4 p-4 bg-background rounded-xl">
              <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden text-primary font-bold text-xl">
                <img v-if="user.avatar" :src="getMediaUrl(user.avatar)" alt="" class="w-full h-full object-cover" />
                <span v-else>{{ user.full_name?.charAt(0) || 'U' }}</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-text text-lg">{{ user.full_name || 'Utilisateur Anonyme' }}</h4>
                  <span v-if="user.is_staff" class="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                    Admin
                  </span>
                </div>
                <div class="flex items-center mt-1">
                  <Icon name="ph:star-fill" class="text-warning w-4 h-4 mr-1" />
                  <span class="text-sm text-textLight">{{ user.rating || '4.5' }}/5</span>
                </div>
              </div>
            </div>

            <!-- Info Grid -->
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3 bg-background rounded-xl">
                <p class="text-xs text-textMuted mb-1">Téléphone</p>
                <p class="text-sm font-semibold text-text">{{ user.phone }}</p>
              </div>
              <div class="p-3 bg-background rounded-xl">
                <p class="text-xs text-textMuted mb-1">Email</p>
                <p class="text-sm font-semibold text-text truncate">{{ user.email || '—' }}</p>
              </div>
              <div class="p-3 bg-background rounded-xl">
                <p class="text-xs text-textMuted mb-1">Statut</p>
                <span
                  class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                  :class="user.is_verified ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'"
                >
                  <Icon :name="user.is_verified ? 'ph:check-circle-fill' : 'ph:clock'" class="mr-1" />
                  {{ user.is_verified ? 'Vérifié' : 'En attente' }}
                </span>
              </div>
              <div class="p-3 bg-background rounded-xl">
                <p class="text-xs text-textMuted mb-1">Compte actif</p>
                <span
                  class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                  :class="user.is_active ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
                >
                  <Icon :name="user.is_active ? 'ph:circle-fill' : 'ph:circle'" class="mr-1" />
                  {{ user.is_active ? 'Actif' : 'Désactivé' }}
                </span>
              </div>
              <div class="p-3 bg-background rounded-xl col-span-2">
                <p class="text-xs text-textMuted mb-1">Inscrit le</p>
                <p class="text-sm font-semibold text-text">
                  {{ user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' }}
                </p>
              </div>
            </div>

            <div class="flex justify-between pt-2">
              <button @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-textLight border border-border rounded-lg hover:bg-background transition-colors">
                Fermer
              </button>
              <button
                @click="$emit('edit', user)"
                class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors flex items-center space-x-2"
              >
                <Icon name="ph:pencil-simple" class="w-4 h-4" />
                <span>Modifier</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  user?: any
}>()

defineEmits<{
  close: []
  edit: [user: any]
}>()
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
