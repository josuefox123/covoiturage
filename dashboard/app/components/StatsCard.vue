<template>
  <div class="bg-card rounded-xl p-5 border border-border shadow-sm flex items-center justify-between">
    <div>
      <p class="text-sm font-medium text-textLight mb-1">{{ title }}</p>
      <h3 class="text-2xl font-bold text-text">{{ value }}</h3>
      <div v-if="trend" class="mt-2 flex items-center text-sm">
        <span :class="trend > 0 ? 'text-success' : 'text-error'" class="flex items-center font-medium">
          <Icon :name="trend > 0 ? 'ph:trend-up' : 'ph:trend-down'" class="mr-1" />
          {{ Math.abs(trend) }}%
        </span>
        <span class="text-textMuted ml-2 text-xs">vs mois dernier</span>
      </div>
    </div>
    <div class="w-12 h-12 rounded-full flex items-center justify-center" :class="colorClass">
      <Icon :name="icon" class="w-6 h-6" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  value: string | number
  icon: string
  trend?: number
  colorClass: string
}>()
</script>
