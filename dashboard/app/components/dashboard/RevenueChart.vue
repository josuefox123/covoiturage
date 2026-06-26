<!--
==========================================================
Fichier :
RevenueChart.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="bg-card rounded-2xl border border-border p-6 shadow-sm">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h3 class="text-lg font-bold text-text">Évolution des revenus</h3>
        <p class="text-sm text-textMuted mt-1">Revenus générés sur les 7 derniers jours</p>
      </div>
      <div class="flex bg-background rounded-lg p-1 border border-border">
        <button 
          @click="activeRange = '7J'" 
          :class="['px-3 py-1 text-xs font-medium rounded-md transition-colors', activeRange === '7J' ? 'bg-white shadow-sm text-text' : 'text-textMuted hover:text-text']"
        >7J</button>
        <button 
          @click="activeRange = '30J'" 
          :class="['px-3 py-1 text-xs font-medium rounded-md transition-colors', activeRange === '30J' ? 'bg-white shadow-sm text-text' : 'text-textMuted hover:text-text']"
        >30J</button>
        <button 
          @click="activeRange = '1A'" 
          :class="['px-3 py-1 text-xs font-medium rounded-md transition-colors', activeRange === '1A' ? 'bg-white shadow-sm text-text' : 'text-textMuted hover:text-text']"
        >1A</button>
      </div>
    </div>

    <div v-if="loading" class="h-[300px] flex items-center justify-center">
      <div class="animate-pulse flex items-end space-x-2 w-full h-48 px-4">
        <div v-for="i in 7" :key="i" class="bg-border rounded-t flex-1" :style="{ height: `${Math.random() * 80 + 20}%` }"></div>
      </div>
    </div>

    <ClientOnly v-else>
      <apexchart type="area" height="300" :options="chartOptions" :series="series"></apexchart>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, defineAsyncComponent } from 'vue'

const apexchart = defineAsyncComponent(() => import('vue3-apexcharts'))

const props = defineProps({
  data: { type: Array, required: true },
  loading: { type: Boolean, default: false }
})

const activeRange = ref('7J')

const series = computed(() => [{
  name: 'Revenus (FCFA)',
  data: props.data.map((d: any) => d.y)
}])

const chartOptions = computed<any>(() => ({
  chart: {
    type: 'area',
    fontFamily: 'inherit',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, easing: 'easeinout', speed: 800 }
  },
  colors: ['#4F46E5'], // Primary color
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.45,
      opacityTo: 0.05,
      stops: [50, 100]
    }
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 3 },
  xaxis: {
    categories: props.data.map((d: any) => d.x),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#9CA3AF', fontSize: '12px' } }
  },
  yaxis: {
    labels: {
      style: { colors: '#9CA3AF', fontSize: '12px' },
      formatter: (value: number) => {
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
        if (value >= 1000) return (value / 1000).toFixed(1) + 'k'
        return value
      }
    }
  },
  grid: {
    borderColor: '#F3F4F6',
    strokeDashArray: 4,
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: true } },
    padding: { top: 0, right: 0, bottom: 0, left: 10 }
  },
  tooltip: {
    theme: 'light',
    y: {
      formatter: (val: number) => new Intl.NumberFormat('fr-FR').format(val) + ' FCFA'
    }
  }
}))
</script>
