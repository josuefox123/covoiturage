<!--
==========================================================
Fichier :
StatCard.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="relative bg-card rounded-2xl border border-border p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 group overflow-hidden">
    <!-- Subtle gradient background effect -->
    <div class="absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-10 blur-2xl transition-all duration-500 group-hover:scale-150" :class="gradientClass"></div>
    
    <div v-if="loading" class="animate-pulse flex flex-col space-y-4">
      <div class="flex justify-between items-start">
        <div class="h-4 w-24 bg-border rounded"></div>
        <div class="h-10 w-10 bg-border rounded-lg"></div>
      </div>
      <div class="h-8 w-16 bg-border rounded"></div>
      <div class="h-3 w-32 bg-border rounded"></div>
    </div>

    <div v-else>
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-sm font-medium text-textMuted">{{ title }}</h3>
        <div class="p-2 rounded-lg" :class="colorClass">
          <Icon :name="icon" class="w-5 h-5" />
        </div>
      </div>
      
      <div class="flex items-baseline space-x-2">
        <h2 class="text-3xl font-bold text-text">{{ formattedValue }}</h2>
        <span v-if="unit" class="text-sm font-medium text-textMuted">{{ unit }}</span>
      </div>

      <div class="mt-3 flex items-center text-xs font-medium">
        <span 
          class="flex items-center space-x-1"
          :class="trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-textMuted'"
        >
          <Icon :name="trend > 0 ? 'ph:trend-up' : trend < 0 ? 'ph:trend-down' : 'ph:minus'" class="w-3 h-3" />
          <span>{{ Math.abs(trend) }}%</span>
        </span>
        <span class="text-textMuted ml-2">vs mois dernier</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  value: { type: [Number, String], required: true },
  icon: { type: String, required: true },
  trend: { type: Number, default: 0 },
  colorClass: { type: String, default: 'bg-primary/10 text-primary' },
  unit: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})

// Extract the text-color part to use for the gradient glow
const gradientClass = computed(() => {
  const match = props.colorClass.match(/text-([a-zA-Z0-9-]+)/)
  return match ? `bg-${match[1]}` : 'bg-primary'
})

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return new Intl.NumberFormat('fr-FR').format(props.value)
  }
  return props.value
})
</script>
