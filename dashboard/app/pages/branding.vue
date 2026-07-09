<!--
==========================================================
Fichier :
branding.vue

Description :
Composant / Vue de l'application Dashboard Zemy.

Projet :
Zemy
==========================================================
-->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
// Import types if needed, using any for broad compatibility with fabric v5/v6
import { useApi } from '../composables/useApi'

definePageMeta({
  layout: 'default',
})

useHead({ title: 'Logo de Démarrage — Zemy' })

const { fetchApi } = useApi()
const authCookie = useCookie('admin_token')
const configRuntime = useRuntimeConfig()

// Canvas state
const canvasRef = ref<HTMLCanvasElement | null>(null)
let fabric: any = null
let fabricCanvas: any = null
let currentImage: any = null

// Form state
const isLoading = ref(true)
const isSaving = ref(false)
const notification = ref({ show: false, type: 'success', message: '' })
let notificationTimer: ReturnType<typeof setTimeout>

// Uploaded file
const selectedFile = ref<File | null>(null)

// Config values (fallback)
const config = ref({
  logoUrl: '',
  scale: 1.0,
  posX: 0,
  posY: 0,
  animationType: 'fade_scale'
})

const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
  clearTimeout(notificationTimer)
  notification.value = { show: true, type, message }
  notificationTimer = setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

const initFabric = () => {
  if (canvasRef.value && fabric) {
    fabricCanvas = new fabric.Canvas(canvasRef.value, {
      width: 320, // Largeur de l'écran interne
      height: 660, // Hauteur de l'écran interne pour un ratio moderne
      backgroundColor: '#2563EB', // Couleur primaire
    })
  }
}

const loadBranding = async () => {
  try {
    isLoading.value = true
    const data = await fetchApi('/branding/').catch(() => null)
    
    if (!data) {
      throw new Error('Impossible de charger la configuration')
    }

    config.value = {
      logoUrl: data?.logo ?? '',
      scale: data?.logo_scale ?? 1.0,
      posX: data?.logo_position_x ?? 0,
      posY: data?.logo_position_y ?? 0,
      animationType: data?.animation_type ?? 'fade_scale'
    }

    if (config.value.logoUrl && fabricCanvas && fabric.Image) {
      // Compatibility wrapper for fromURL if running on older fabric versions, 
      // or native Promise if v6
      let fromURLPromise: Promise<any>;
      if (fabric.Image.fromURL.length >= 2) {
        // v5 signature
        fromURLPromise = new Promise((resolve) => {
          fabric.Image.fromURL(config.value.logoUrl, resolve, { crossOrigin: 'anonymous' })
        })
      } else {
        // v6 signature
        fromURLPromise = fabric.Image.fromURL(config.value.logoUrl, { crossOrigin: 'anonymous' })
      }

      fromURLPromise
        .then((img: any) => {
          currentImage = img
          img.set({
            originX: 'center',
            originY: 'center',
            transparentCorners: false,
            cornerColor: '#ffffff',
            cornerStrokeColor: '#000000',
            borderColor: '#ffffff',
          })
          fabricCanvas?.add(img)
          
          if (img.width && img.height) {
            let fabricScale = config.value.scale
            if (img.width >= img.height) {
               fabricScale = (config.value.scale * 200) / img.width
            } else {
               fabricScale = (config.value.scale * 200) / img.height
            }
            img.set({ scaleX: fabricScale, scaleY: fabricScale })
          }
          
          if (config.value.posX === 0 && config.value.posY === 0) {
              fabricCanvas?.centerObject(img)
          } else {
              img.set({ 
                left: Number(config.value.posX), 
                top: Number(config.value.posY) 
              })
          }
          fabricCanvas?.renderAll()
        })
        .catch(console.error)
    }
  } catch (e) {
    showNotification("Erreur lors du chargement de la configuration", "error")
  } finally {
    isLoading.value = false
  }
}

const handleFileUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedFile.value = input.files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (fabricCanvas && fabric.Image) {
        if (currentImage) {
          fabricCanvas.remove(currentImage)
        }
        
        let fromURLPromise: Promise<any>;
        if (fabric.Image.fromURL.length >= 2) {
          fromURLPromise = new Promise((resolve) => {
            fabric.Image.fromURL(dataUrl, resolve)
          })
        } else {
          fromURLPromise = fabric.Image.fromURL(dataUrl)
        }

        fromURLPromise
          .then((img: any) => {
            currentImage = img
            img.set({
              originX: 'center',
              originY: 'center',
              transparentCorners: false,
              cornerColor: '#ffffff',
              cornerStrokeColor: '#000000',
              borderColor: '#ffffff',
            })
            
            if (img.width && img.width > 200) {
               img.scaleToWidth(200)
            }

            fabricCanvas?.add(img)
            fabricCanvas?.centerObject(img)
            fabricCanvas?.renderAll()
          })
          .catch(console.error)
      }
    }
    reader.readAsDataURL(input.files[0])
  }
}

const saveBranding = async () => {
  if (!authCookie.value) {
    showNotification('Session expirée. Veuillez vous reconnecter.', 'error')
    return
  }

  if (!currentImage && !config.value.logoUrl) {
    showNotification("Veuillez uploader un logo", "error")
    return
  }

  try {
    isSaving.value = true
    const formData = new FormData()

    if (currentImage) {
      let rnScale = currentImage.scaleX || 1
      if (currentImage.width && currentImage.height) {
        if (currentImage.width >= currentImage.height) {
          rnScale = (currentImage.width * (currentImage.scaleX || 1)) / 200
        } else {
          rnScale = (currentImage.height * (currentImage.scaleY || 1)) / 200
        }
      }
      
      formData.append('logo_position_x', currentImage.left?.toString() || '0')
      formData.append('logo_position_y', currentImage.top?.toString() || '0')
      formData.append('logo_scale', rnScale.toString())
    }

    formData.append('animation_type', config.value.animationType)

    if (selectedFile.value) {
      formData.append('logo', selectedFile.value)
    }

    const headers = {
      'Authorization': `Bearer ${authCookie.value}`
    }

    const apiUrl = configRuntime.public?.apiUrl || 'https://zemy.erika-app.com/api'

    await $fetch(`${apiUrl}/branding/`, {
      method: 'PUT',
      headers,
      body: formData
    })

    showNotification("Configuration mise à jour avec succès")
  } catch (error) {
    console.error(error)
    showNotification("Erreur lors de la sauvegarde", "error")
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  if (!import.meta.client) return

  const fabricModule: any = await import('fabric')
  fabric = {
    Canvas: fabricModule.Canvas || fabricModule.fabric?.Canvas,
    Image: fabricModule.Image || fabricModule.FabricImage || fabricModule.fabric?.Image || fabricModule.fabric?.FabricImage
  }

  initFabric()
  loadBranding()
})

onUnmounted(() => {
  if (fabricCanvas) {
    fabricCanvas.dispose()
    fabricCanvas = null
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-text">Logo de Démarrage</h1>
        <p class="text-textMuted mt-1">Gérez le logo affiché à l'ouverture de l'application mobile et son animation.</p>
      </div>
      <button 
        @click="saveBranding" 
        :disabled="isSaving || isLoading"
        class="bg-primary hover:bg-primaryDark text-white px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 w-fit self-start sm:self-auto"
      >
        <Icon v-if="isSaving" name="ph:spinner-gap-bold" class="w-5 h-5 animate-spin" />
        <Icon v-else name="ph:floppy-disk-bold" class="w-5 h-5" />
        <span>{{ isSaving ? 'Sauvegarde...' : 'Enregistrer' }}</span>
      </button>
    </div>

    <!-- Notifications -->
    <div v-if="notification.show" 
         :class="[
           'p-4 rounded-lg flex items-center gap-3',
           notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
         ]">
      <Icon :name="notification.type === 'success' ? 'ph:check-circle-fill' : 'ph:warning-fill'" class="w-5 h-5" />
      <span class="font-medium">{{ notification.message }}</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      <!-- Editor Column (Phone Simulator) -->
      <div class="lg:col-span-5 bg-white rounded-xl shadow-sm border border-border p-6 flex flex-col items-center">
        <h2 class="text-lg font-semibold text-text mb-2 w-full text-center">Aperçu Mobile (Splash Screen)</h2>
        <p class="text-sm text-textMuted mb-6 w-full text-center">Simulateur d'écran. Déplacez et redimensionnez le logo.</p>
        
        <div v-if="isLoading" class="w-[340px] h-[680px] bg-gray-100 rounded-[50px] flex items-center justify-center border-[10px] border-black">
           <Icon name="ph:spinner-gap-bold" class="w-8 h-8 animate-spin text-primary" />
        </div>
        
        <!-- Realistic Phone Container -->
        <div v-show="!isLoading" class="relative w-[340px] h-[680px] shrink-0 mx-auto bg-black rounded-[50px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-[10px] ring-2 ring-gray-200">
           
           <!-- Power / Volume Buttons simulation -->
           <div class="absolute -right-[4px] top-[150px] w-[4px] h-[60px] bg-gray-800 rounded-r-md"></div>
           <div class="absolute -left-[4px] top-[120px] w-[4px] h-[40px] bg-gray-800 rounded-l-md"></div>
           <div class="absolute -left-[4px] top-[180px] w-[4px] h-[60px] bg-gray-800 rounded-l-md"></div>

           <!-- Screen content -->
           <div class="relative w-full h-full bg-[#2563EB] rounded-[40px] overflow-hidden flex flex-col items-center justify-center">
             
             <!-- Notch simulator -->
             <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[140px] h-[30px] bg-black rounded-b-[20px] z-20 flex justify-center items-center">
               <div class="w-16 h-1.5 rounded-full bg-gray-800"></div>
               <div class="w-2 h-2 rounded-full bg-[#0a1128] absolute right-4"></div>
             </div>

             <!-- Fabric Canvas -->
             <canvas ref="canvasRef"></canvas>
             
             <!-- Home Indicator simulator -->
             <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-[5px] bg-white/50 rounded-full z-20 pointer-events-none"></div>
           </div>
        </div>
      </div>

      <!-- Settings Column -->
      <div class="lg:col-span-7 space-y-6">
        <div class="bg-white rounded-xl shadow-sm border border-border p-6">
           <h3 class="text-lg font-semibold text-text mb-4">Télécharger un nouveau logo</h3>
           
           <div class="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept="image/png, image/jpeg, image/svg+xml" 
                @change="handleFileUpload" 
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Icon name="ph:upload-simple-bold" class="w-10 h-10 text-primary mb-3" />
              <p class="text-text font-medium">Cliquez ou glissez une image ici</p>
              <p class="text-sm text-textMuted mt-1">Format recommandé : PNG transparent ou SVG.</p>
              <p class="text-xs text-textMuted mt-1">Dimensions recommandées : 500x500 pixels (carré).</p>
           </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-border p-6">
           <h3 class="text-lg font-semibold text-text mb-4">Animation</h3>
           <select v-model="config.animationType" class="w-full border border-border rounded-lg px-4 py-2.5 text-text bg-gray-50 focus:bg-white focus:border-primary transition-all outline-none">
             <option value="fade_scale">Fondu & Zoom</option>
             <option value="bounce">Rebond (Bounce)</option>
             <option value="pulse">Pulsation (Pulse)</option>
           </select>
           <p class="text-sm text-textMuted mt-2">Choisissez l'effet d'apparition du logo à l'ouverture de l'application.</p>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-border p-6">
           <h3 class="text-lg font-semibold text-text mb-4">Instructions</h3>
           <ul class="space-y-3 text-textMuted">
              <li class="flex gap-2">
                 <Icon name="ph:check-circle-fill" class="w-5 h-5 text-success shrink-0" />
                 <span>Le fond bleu de l'aperçu correspond à la couleur primaire de l'application mobile. Utilisez de préférence un logo blanc (ou contrastant) avec fond transparent.</span>
              </li>
              <li class="flex gap-2">
                 <Icon name="ph:check-circle-fill" class="w-5 h-5 text-success shrink-0" />
                 <span>Sélectionnez l'image dans l'aperçu mobile pour la déplacer ou utiliser les poignées pour la redimensionner proportionnellement.</span>
              </li>
              <li class="flex gap-2">
                 <Icon name="ph:check-circle-fill" class="w-5 h-5 text-success shrink-0" />
                 <span>N'oubliez pas de cliquer sur <strong>Enregistrer</strong> pour appliquer ces modifications à l'application mobile.</span>
              </li>
           </ul>
        </div>
      </div>

    </div>
  </div>
</template>
