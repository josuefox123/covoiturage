<!--
==========================================================
Fichier :
LiveMap.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<template>
  <div class="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col h-[450px]">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-bold text-text">Trajets Actifs (En Temps Réel)</h3>
      <div class="flex items-center space-x-2">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
        </span>
        <span class="text-sm font-medium text-textMuted">Live</span>
      </div>
    </div>
    
    <div v-if="loading" class="flex-1 rounded-xl bg-border animate-pulse"></div>
    
    <div v-else class="flex-1 relative rounded-xl overflow-hidden border border-border">
      <ClientOnly>
        <div id="dashboard-live-map" class="absolute inset-0 z-0"></div>
      </ClientOnly>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  mapData: { type: Array as () => any[], required: true },
  loading: { type: Boolean, default: false }
})

let map: any = null
let markers: any[] = []

onMounted(async () => {
  // We dynamically import leaflet to avoid SSR issues
  if (process.client && !props.loading) {
    initMap()
  }
})

watch(() => props.loading, (newVal) => {
  if (!newVal && process.client && !map) {
    // Small timeout to ensure the div is rendered
    setTimeout(initMap, 100)
  }
})

watch(() => props.mapData, (newVal) => {
  if (map && process.client) {
    updateMarkers()
  }
}, { deep: true })

const initMap = async () => {
  try {
    const L = (await import('leaflet')).default
    import('leaflet/dist/leaflet.css')

    // Fix leaflet marker icon issue in webpack/vite
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })

    // Center roughly on Cotonou, Benin
    map = L.map('dashboard-live-map').setView([6.36536, 2.41833], 12)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map)

    updateMarkers()
  } catch (e) {
    console.error('Failed to init map', e)
  }
}

const updateMarkers = async () => {
  if (!map) return
  const L = (await import('leaflet')).default
  
  // Clear existing
  markers.forEach(m => map.removeLayer(m))
  markers = []

  // Add new
  props.mapData.forEach(point => {
    if (point.lat && point.lng) {
      const iconHtml = `<div style="background-color: #4F46E5; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>`
      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })

      const marker = L.marker([point.lat, point.lng], { icon: customIcon })
        .bindPopup(`<b>Conducteur:</b> ${point.driver}<br><b>Statut:</b> ${point.status}`)
        .addTo(map)
      markers.push(marker)
    }
  })
}

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style>
.custom-leaflet-marker {
  background: transparent;
  border: none;
}
</style>
