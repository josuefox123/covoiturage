<!--
==========================================================
Fichier :
RecentActivity.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="bg-card rounded-2xl border border-border p-6 shadow-sm">
    <div class="flex justify-between items-center mb-6">
      <h3 class="text-lg font-bold text-text">Activités récentes</h3>
      <button class="text-sm font-medium text-primary hover:text-primary/80 transition-colors">Tout voir</button>
    </div>

    <div v-if="loading" class="space-y-6">
      <div v-for="i in 5" :key="i" class="flex items-start space-x-4 animate-pulse">
        <div class="w-10 h-10 rounded-full bg-border flex-shrink-0"></div>
        <div class="flex-1 space-y-2">
          <div class="h-4 bg-border rounded w-3/4"></div>
          <div class="h-3 bg-border rounded w-1/4"></div>
        </div>
      </div>
    </div>

    <div v-else-if="!activities.length" class="py-8 text-center text-textMuted">
      Aucune activité récente
    </div>

    <div v-else class="relative">
      <!-- Ligne verticale de la timeline -->
      <div class="absolute top-2 bottom-2 left-5 w-px bg-border -z-10"></div>
      
      <div class="space-y-6">
        <div v-for="(activity, idx) in activities" :key="activity.id || idx" class="flex items-start space-x-4 group">
          <div 
            class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-white"
            :class="activity.color || 'bg-primary/10 text-primary'"
          >
            <Icon :name="activity.icon || 'ph:activity'" class="w-5 h-5" />
          </div>
          
          <div class="flex-1 pt-1">
            <p class="text-sm font-medium text-text">
              {{ activity.type }}
              <span v-if="activity.user" class="font-bold">· {{ activity.user }}</span>
            </p>
            <p class="text-xs text-textMuted mt-1">{{ formatTime(activity.time) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  activities: { type: Array as () => any[], required: true },
  loading: { type: Boolean, default: false }
})

const formatTime = (timeStr: string) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return "À l'instant"
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)} h`
  return new Intl.DateTimeFormat('fr-FR', { 
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  }).format(date)
}
</script>
