<!--
==========================================================
Fichier :
DistributionChart.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col">
    <h3 class="text-lg font-bold text-text mb-4">{{ title }}</h3>
    
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="w-48 h-48 rounded-full border-[16px] border-border animate-pulse"></div>
    </div>

    <ClientOnly v-else>
      <div class="flex-1 flex flex-col justify-center">
        <apexchart type="donut" height="250" :options="chartOptions" :series="series"></apexchart>
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  labels: { type: Array, required: true },
  series: { type: Array, required: true },
  colors: { type: Array, default: () => ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'] },
  loading: { type: Boolean, default: false }
})

const chartOptions = computed(() => ({
  chart: {
    type: 'donut',
    fontFamily: 'inherit',
    animations: { enabled: true, easing: 'easeinout', speed: 800 }
  },
  labels: props.labels,
  colors: props.colors,
  plotOptions: {
    pie: {
      donut: {
        size: '75%',
        labels: {
          show: true,
          name: {
            fontSize: '14px',
            color: '#6B7280'
          },
          value: {
            fontSize: '24px',
            fontWeight: 700,
            color: '#111827',
            formatter: (val: number) => val
          },
          total: {
            show: true,
            showAlways: false,
            label: 'Total',
            fontSize: '14px',
            color: '#6B7280',
            formatter: (w: any) => {
              return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)
            }
          }
        }
      }
    }
  },
  dataLabels: { enabled: false },
  stroke: { width: 0 },
  legend: {
    position: 'bottom',
    horizontalAlign: 'center',
    markers: { radius: 12 },
    itemMargin: { horizontal: 10, vertical: 5 }
  },
  tooltip: {
    theme: 'light',
    y: {
      formatter: (val: number) => val
    }
  }
}))
</script>
