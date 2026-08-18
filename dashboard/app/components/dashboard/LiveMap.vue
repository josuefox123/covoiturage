<!--
==========================================================
Fichier :
LiveMap.vue

Description :
Composant Dashboard Zemy
Cartographie Google Maps en temps réel des trajets actifs.

Fonctionnalités :
- Marqueurs conducteurs en temps réel
- Animation des déplacements
- Trajectoires
- InfoWindow détaillée
- Compteur de trajets actifs
- Rafraîchissement automatique
- Recentrage automatique
- Recentrage manuel
- Gestion des conducteurs inactifs
==========================================================
-->

<template>
  <div
    class="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col"
  >
    <!-- =====================================================
         HEADER
    ====================================================== -->
    <div
      class="px-6 py-5 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"
          >
            <Icon name="ph:car-bold" class="w-5 h-5 text-emerald-600" />
          </div>

          <div>
            <h3 class="text-lg font-bold text-text">
              Trajets actifs
            </h3>

            <p class="text-xs text-textMuted mt-0.5">
              Suivi des conducteurs en temps réel
            </p>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Compteur -->
        <div
          class="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-border"
        >
          <span class="text-sm font-bold text-text">
            {{ activeDriversCount }}
          </span>

          <span class="text-xs text-textMuted">
            conducteur{{ activeDriversCount > 1 ? 's' : '' }}
          </span>
        </div>

        <!-- LIVE -->
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100"
        >
          <span class="relative flex h-2.5 w-2.5">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"
            ></span>

            <span
              class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"
            ></span>
          </span>

          <span class="text-xs font-bold text-emerald-700">
            LIVE
          </span>
        </div>

        <!-- Refresh -->
        <button
          type="button"
          class="w-10 h-10 rounded-xl border border-border bg-white hover:bg-gray-50 transition flex items-center justify-center"
          :class="{ 'animate-spin': refreshing }"
          title="Actualiser"
          @click="manualRefresh"
        >
          <span class="text-lg">↻</span>
        </button>
      </div>
    </div>

    <!-- =====================================================
         MAP
    ====================================================== -->
    <div class="relative h-[520px] bg-gray-100">
      <!-- Loading -->
      <div
        v-if="loading"
        class="absolute inset-0 z-20 bg-gray-100 animate-pulse"
      >
        <div
          class="absolute top-5 left-5 w-48 h-8 bg-gray-200 rounded-lg"
        ></div>

        <div
          class="absolute top-20 left-10 w-10 h-10 bg-gray-200 rounded-full"
        ></div>

        <div
          class="absolute bottom-24 right-20 w-10 h-10 bg-gray-200 rounded-full"
        ></div>
      </div>

      <!-- Google Map -->
      <div
        ref="mapContainer"
        class="absolute inset-0"
      ></div>

      <!-- ===================================================
           TOP LEFT MAP STATUS
      ==================================================== -->
      <div
        class="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-md rounded-2xl border border-white shadow-lg px-4 py-3"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center"
          >
            <Icon name="ph:map-pin-bold" class="w-5 h-5 text-emerald-600" />
          </div>

          <div>
            <p class="text-xs text-textMuted">
              Trajets en cours
            </p>

            <p class="text-lg font-bold text-text">
              {{ activeDriversCount }}
            </p>
          </div>
        </div>
      </div>

      <!-- ===================================================
           DERNIÈRE MISE À JOUR
      ==================================================== -->
      <div
        class="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md rounded-xl border border-white shadow-lg px-3 py-2"
      >
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>

          <span class="text-xs text-textMuted">
            Mis à jour {{ lastUpdateLabel }}
          </span>
        </div>
      </div>

      <!-- ===================================================
           CONTROLES MAP
      ==================================================== -->
      <div
        class="absolute right-4 bottom-4 z-10 flex flex-col gap-2"
      >
        <!-- Recentrer -->
        <button
          type="button"
          class="w-11 h-11 bg-white rounded-xl shadow-lg border border-border hover:bg-gray-50 transition flex items-center justify-center"
          title="Afficher tous les conducteurs"
          @click="fitAllMarkers"
        >
          <Icon name="ph:target" class="w-5 h-5 text-gray-700" />
        </button>

        <!-- Zoom in -->
        <button
          type="button"
          class="w-11 h-11 bg-white rounded-xl shadow-lg border border-border hover:bg-gray-50 transition flex items-center justify-center text-lg font-bold"
          title="Zoom avant"
          @click="zoomIn"
        >
          +
        </button>

        <!-- Zoom out -->
        <button
          type="button"
          class="w-11 h-11 bg-white rounded-xl shadow-lg border border-border hover:bg-gray-50 transition flex items-center justify-center text-lg font-bold"
          title="Zoom arrière"
          @click="zoomOut"
        >
          −
        </button>
      </div>

      <!-- ===================================================
           EMPTY STATE
      ==================================================== -->
      <div
        v-if="!loading && activeDriversCount === 0"
        class="absolute inset-0 z-[5] pointer-events-none flex items-center justify-center"
      >
        <div
          class="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-border px-8 py-6 text-center"
        >
          <div
            class="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-3 text-gray-400"
          >
            <Icon name="ph:car-profile" class="w-8 h-8" />
          </div>

          <h4 class="font-bold text-text">
            Aucun trajet actif
          </h4>

          <p class="text-sm text-textMuted mt-1">
            Les conducteurs en trajet apparaîtront ici.
          </p>
        </div>
      </div>
    </div>

    <!-- =====================================================
         FOOTER
    ====================================================== -->
    <div
      class="px-6 py-3 border-t border-border bg-gray-50 flex items-center justify-between"
    >
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>

        <span class="text-xs font-medium text-textMuted">
          Suivi en temps réel
        </span>
      </div>

      <span class="text-xs text-textMuted">
        Actualisation toutes les {{ refreshInterval / 1000 }}s
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch
} from 'vue'

/* ==========================================================
   PROPS
========================================================== */

const props = defineProps({
  mapData: {
    type: Array as () => any[],
    required: true
  },

  loading: {
    type: Boolean,
    default: false
  }
})

/* ==========================================================
   MAP
========================================================== */

const mapContainer = ref<HTMLDivElement | null>(null)

let map: any = null

const markersMap = new Map<
  string,
  {
    marker: any
    infoWindow: any
    currentPosition: {
      lat: number
      lng: number
    }
  }
>()

const polylinesMap = new Map<string, any>()

/* ==========================================================
   CONFIGURATION
========================================================== */

const refreshInterval = 10000

let refreshTimer: ReturnType<typeof setInterval> | null = null

const refreshing = ref(false)

const lastUpdate = ref<Date | null>(null)

const GOOGLE_MAPS_API_KEY = 'AIzaSyDeQDN8_mfUVNcb37Tg1FsiMaBoCuYOgrc'

/* ==========================================================
   COMPUTED
========================================================== */

const activeDriversCount = computed(() => {
  const drivers = new Set<string>()

  props.mapData.forEach((point: any) => {
    if (
      point &&
      point.lat !== undefined &&
      point.lng !== undefined &&
      point.driver
    ) {
      drivers.add(String(point.driver))
    }
  })

  return drivers.size
})

const lastUpdateLabel = computed(() => {
  if (!lastUpdate.value) {
    return 'à l’instant'
  }

  const seconds = Math.floor(
    (Date.now() - lastUpdate.value.getTime()) / 1000
  )

  if (seconds < 5) {
    return 'à l’instant'
  }

  if (seconds < 60) {
    return `il y a ${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)

  return `il y a ${minutes} min`
})

/* ==========================================================
   GOOGLE MAPS
========================================================== */

const loadGoogleMaps = () => {
  if (!import.meta.client) return

  if (!GOOGLE_MAPS_API_KEY) {
    console.error(
      '[LiveMap] VITE_GOOGLE_MAPS_API_KEY est manquante.'
    )

    return
  }

  if (
    (window as any).google &&
    (window as any).google.maps
  ) {
    initMap()
    return
  }

  const scriptId = 'google-maps-script'

  const existingScript =
    document.getElementById(scriptId)

  if (existingScript) {
    return
  }

  const script = document.createElement('script')

  script.id = scriptId

  script.src =
    `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`

  script.async = true
  script.defer = true

  script.onload = () => {
    initMap()
  }

  script.onerror = () => {
    console.error(
      '[LiveMap] Impossible de charger Google Maps.'
    )
  }

  document.head.appendChild(script)
}

/* ==========================================================
   INITIALISATION MAP
========================================================== */

const initMap = () => {
  if (
    !mapContainer.value ||
    !(window as any).google
  ) {
    return
  }

  const google = (window as any).google

  const center = {
    lat: 6.36536,
    lng: 2.41833
  }

  map = new google.maps.Map(
    mapContainer.value,
    {
      center,

      zoom: 12,

      minZoom: 8,
      maxZoom: 18,

      mapTypeControl: false,

      streetViewControl: false,

      fullscreenControl: false,

      clickableIcons: false,

      gestureHandling: 'greedy',

      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [
            {
              visibility: 'off'
            }
          ]
        },

        {
          featureType: 'transit',
          elementType: 'labels',
          stylers: [
            {
              visibility: 'off'
            }
          ]
        }
      ]
    }
  )

  updateMarkers()
}

/* ==========================================================
   CRÉATION DU MARKER
========================================================== */

const createMarkerIcon = () => {
  const google = (window as any).google

  return {
    path: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-10c-.66 0-1.21.42-1.42 1.01L4 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h10v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.27-3.82c.14-.4.52-.68.96-.68h10.52c.44 0 .82.28.96.68L19 11H5z',
    fillColor: '#10B981', // Vert Emerald Zemy
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 1.5,
    scale: 1.4,
    anchor: new google.maps.Point(12, 12)
  }
}

/* ==========================================================
   NORMALISATION POSITION
========================================================== */

const getPosition = (point: any) => {
  const lat = Number(point.lat)

  const lng = Number(point.lng)

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null
  }

  return {
    lat,
    lng
  }
}

/* ==========================================================
   POPUP
========================================================== */

const createInfoContent = (point: any) => {
  const driver =
    point.driver ||
    'Conducteur'

  const status =
    point.status ||
    'En cours'

  const origin =
    point.departure ||
    point.departure_location ||
    'Départ non renseigné'

  const destination =
    point.arrival ||
    point.arrival_location ||
    'Destination non renseignée'

  const vehicle =
    point.vehicle ||
    point.vehicle_model ||
    'Véhicule non renseigné'

  return `
    <div
      style="
        min-width:240px;
        padding:4px;
        font-family:Arial,sans-serif;
        color:#111827;
      "
    >

      <div
        style="
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:12px;
        "
      >

        <div
          style="
            width:40px;
            height:40px;
            border-radius:12px;
            background:#ECFDF5;
            display:flex;
            align-items:center;
            justify-content:center;
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#059669">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-10c-.66 0-1.21.42-1.42 1.01L4 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h10v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.27-3.82c.14-.4.52-.68.96-.68h10.52c.44 0 .82.28.96.68L19 11H5z"/>
          </svg>
        </div>

        <div>

          <div
            style="
              font-weight:700;
              font-size:14px;
            "
          >
            ${escapeHtml(driver)}
          </div>

          <div
            style="
              color:#059669;
              font-size:11px;
              font-weight:600;
              margin-top:2px;
            "
          >
            ● ${escapeHtml(status)}
          </div>

        </div>

      </div>

      <div
        style="
          border-top:1px solid #E5E7EB;
          padding-top:10px;
        "
      >

        <div
          style="
            font-size:11px;
            color:#6B7280;
            margin-bottom:4px;
          "
        >
          TRAJET
        </div>

        <div
          style="
            font-size:12px;
            font-weight:600;
            margin-bottom:6px;
            display: flex;
            align-items: center;
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#10B981" style="margin-right:6px; flex-shrink: 0;">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          ${escapeHtml(origin)}
        </div>

        <div
          style="
            font-size:12px;
            font-weight:600;
            display: flex;
            align-items: center;
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="#374151" style="margin-right:6px; flex-shrink: 0;">
            <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6z"/>
          </svg>
          ${escapeHtml(destination)}
        </div>

      </div>

      <div
        style="
          margin-top:12px;
          padding-top:10px;
          border-top:1px solid #E5E7EB;
          font-size:11px;
          color:#6B7280;
          display: flex;
          align-items: center;
        "
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="#6B7280" style="margin-right:6px; flex-shrink: 0;">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-10c-.66 0-1.21.42-1.42 1.01L4 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h10v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.27-3.82c.14-.4.52-.68.96-.68h10.52c.44 0 .82.28.96.68L19 11H5z"/>
        </svg>
        ${escapeHtml(vehicle)}
      </div>

    </div>
  `
}

/* ==========================================================
   PROTECTION HTML
========================================================== */

const escapeHtml = (value: any) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/* ==========================================================
   ANIMATION POSITION
========================================================== */

const animateMarker = (
  marker: any,
  from: {
    lat: number
    lng: number
  },
  to: {
    lat: number
    lng: number
  },
  duration = 1000
) => {
  const start = performance.now()

  const animate = (currentTime: number) => {
    const elapsed =
      currentTime - start

    const progress = Math.min(
      elapsed / duration,
      1
    )

    /*
     * Smooth easing.
     */
    const eased =
      progress < 0.5
        ? 2 * progress * progress
        : 1 -
          Math.pow(
            -2 * progress + 2,
            2
          ) / 2

    const lat =
      from.lat +
      (to.lat - from.lat) * eased

    const lng =
      from.lng +
      (to.lng - from.lng) * eased

    marker.setPosition({
      lat,
      lng
    })

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}

/* ==========================================================
   MISE À JOUR MARKERS
========================================================== */

const updateMarkers = () => {
  if (
    !map ||
    !(window as any).google
  ) {
    return
  }

  const google = (window as any).google

  const bounds =
    new google.maps.LatLngBounds()

  const activeDrivers =
    new Set<string>()

  let hasValidMarkers = false

  props.mapData.forEach(
    (point: any) => {
      const position =
        getPosition(point)

      if (!position) {
        return
      }

      const key = String(
        point.driver_id ||
        point.driver ||
        point.id
      )

      activeDrivers.add(key)

      const content =
        createInfoContent(point)

      /*
       * Marker déjà existant
       */
      if (markersMap.has(key)) {
        const existing =
          markersMap.get(key)!

        const oldPosition =
          existing.currentPosition

        const moved =
          Math.abs(
            oldPosition.lat -
              position.lat
          ) > 0.000001 ||
          Math.abs(
            oldPosition.lng -
              position.lng
          ) > 0.000001

        if (moved) {
          animateMarker(
            existing.marker,
            oldPosition,
            position,
            1200
          )

          existing.currentPosition =
            position
        }

        existing.infoWindow.setContent(
          content
        )

        bounds.extend(position)

        hasValidMarkers = true

        /*
         * Créer / mettre à jour trajectoire
         */
        updatePolyline(
          key,
          point,
          position
        )

        return
      }

      /*
       * Nouveau marker
       */

      const marker =
        new google.maps.Marker({
          position,
          map,

          title:
            point.driver ||
            'Conducteur',

          icon:
            createMarkerIcon(),

          optimized: true,

          animation:
            google.maps.Animation.DROP
        })

      const infoWindow =
        new google.maps.InfoWindow({
          content
        })

      marker.addListener(
        'click',
        () => {
          infoWindow.open(
            map,
            marker
          )
        }
      )

      markersMap.set(
        key,
        {
          marker,
          infoWindow,
          currentPosition:
            position
        }
      )

      bounds.extend(position)

      hasValidMarkers = true

      updatePolyline(
        key,
        point,
        position
      )
    }
  )

  /*
   * Supprimer conducteurs disparus
   */
  for (
    const [
      key,
      value
    ] of markersMap.entries()
  ) {
    if (
      !activeDrivers.has(key)
    ) {
      value.marker.setMap(
        null
      )

      value.infoWindow.close()

      markersMap.delete(key)

      removePolyline(key)
    }
  }

  /*
   * Mise à jour timestamp
   */
  if (hasValidMarkers) {
    lastUpdate.value =
      new Date()
  }
}

/* ==========================================================
   TRAJECTOIRE
========================================================== */

const updatePolyline = (
  key: string,
  point: any,
  position: {
    lat: number
    lng: number
  }
) => {
  if (
    !map ||
    !(window as any).google
  ) {
    return
  }

  const google =
    (window as any).google

  /*
   * Si l'API fournit déjà un trajet,
   * utiliser departure_path / route_path.
   */
  const rawPath =
    point.route_path ||
    point.path ||
    point.polyline

  if (
    !rawPath ||
    !Array.isArray(rawPath)
  ) {
    return
  }

  const path = rawPath
    .map((item: any) => {
      if (
        Array.isArray(item) &&
        item.length >= 2
      ) {
        return {
          lat: Number(item[0]),
          lng: Number(item[1])
        }
      }

      if (
        item.lat !== undefined &&
        item.lng !== undefined
      ) {
        return {
          lat: Number(item.lat),
          lng: Number(item.lng)
        }
      }

      return null
    })
    .filter(Boolean)

  if (!path.length) {
    return
  }

  path.push(position)

  /*
   * Supprimer ancienne ligne
   */
  removePolyline(key)

  const polyline =
    new google.maps.Polyline({
      path,

      geodesic: true,

      strokeColor:
        '#10B981',

      strokeOpacity:
        0.75,

      strokeWeight:
        4,

      map
    })

  polylinesMap.set(
    key,
    polyline
  )
}

/* ==========================================================
   SUPPRESSION TRAJECTOIRE
========================================================== */

const removePolyline = (
  key: string
) => {
  const polyline =
    polylinesMap.get(key)

  if (polyline) {
    polyline.setMap(null)

    polylinesMap.delete(key)
  }
}

/* ==========================================================
   FIT ALL
========================================================== */

const fitAllMarkers = () => {
  if (
    !map ||
    !(window as any).google ||
    markersMap.size === 0
  ) {
    return
  }

  const google =
    (window as any).google

  const bounds =
    new google.maps.LatLngBounds()

  markersMap.forEach(
    ({ currentPosition }) => {
      bounds.extend(
        currentPosition
      )
    }
  )

  if (markersMap.size === 1) {
    const position =
      bounds.getCenter()

    map.panTo(position)

    map.setZoom(14)

    return
  }

  map.fitBounds(
    bounds,
    {
      top: 100,
      right: 100,
      bottom: 100,
      left: 100
    }
  )
}

/* ==========================================================
   ZOOM
========================================================== */

const zoomIn = () => {
  if (!map) return

  const zoom =
    map.getZoom() || 12

  map.setZoom(
    Math.min(
      zoom + 1,
      18
    )
  )
}

const zoomOut = () => {
  if (!map) return

  const zoom =
    map.getZoom() || 12

  map.setZoom(
    Math.max(
      zoom - 1,
      8
    )
  )
}

/* ==========================================================
   REFRESH MANUEL
========================================================== */

const manualRefresh = async () => {
  refreshing.value = true

  /*
   * IMPORTANT :
   * Le composant reçoit mapData depuis le parent.
   *
   * Le refresh réel de l'API doit donc être fait
   * par le parent.
   *
   * Ici on force simplement la mise à jour
   * des markers.
   */

  updateMarkers()

  setTimeout(() => {
    refreshing.value = false
  }, 500)
}

/* ==========================================================
   AUTO REFRESH
========================================================== */

const startAutoRefresh = () => {
  stopAutoRefresh()

  refreshTimer =
    setInterval(() => {
      if (
        map &&
        !props.loading
      ) {
        updateMarkers()
      }
    }, refreshInterval)
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(
      refreshTimer
    )

    refreshTimer = null
  }
}

/* ==========================================================
   WATCHERS
========================================================== */

watch(
  () => props.loading,
  (newValue) => {
    if (
      !newValue &&
      import.meta.client &&
      !map
    ) {
      setTimeout(
        loadGoogleMaps,
        100
      )
    }
  }
)

watch(
  () => props.mapData,
  () => {
    if (
      map &&
      import.meta.client
    ) {
      updateMarkers()
    }
  },
  {
    deep: true
  }
)

/* ==========================================================
   LIFECYCLE
========================================================== */

onMounted(() => {
  if (
    import.meta.client &&
    !props.loading
  ) {
    loadGoogleMaps()
  }

  startAutoRefresh()
})

onBeforeUnmount(() => {
  stopAutoRefresh()

  markersMap.forEach(
    ({
      marker,
      infoWindow
    }) => {
      marker.setMap(null)
      infoWindow.close()
    }
  )

  markersMap.clear()

  polylinesMap.forEach(
    (polyline) => {
      polyline.setMap(null)
    }
  )

  polylinesMap.clear()

  map = null
})
</script>