<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-text">Trajets</h1>
      <button class="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors flex items-center">
        <Icon name="ph:plus" class="mr-2" />
        Ajouter
      </button>
    </div>

    <div class="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <div class="flex space-x-2">
          <select class="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option>Tous les statuts</option>
            <option>Actif</option>
            <option>Terminé</option>
            <option>Annulé</option>
          </select>
        </div>
        <div class="relative w-64">
          <Icon name="ph:magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
          <input 
            type="text" 
            placeholder="Rechercher une ville..." 
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
          >
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-background/50 text-textLight">
            <tr>
              <th class="px-6 py-3 font-semibold">Itinéraire</th>
              <th class="px-6 py-3 font-semibold">Date & Heure</th>
              <th class="px-6 py-3 font-semibold">Places</th>
              <th class="px-6 py-3 font-semibold">Prix</th>
              <th class="px-6 py-3 font-semibold">Statut</th>
              <th class="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="pending" class="text-center py-10">
              <td colspan="6" class="py-10 text-textMuted">Chargement...</td>
            </tr>
            <tr v-else-if="rides.length === 0" class="text-center py-10">
              <td colspan="6" class="py-10 text-textMuted">Aucun trajet trouvé.</td>
            </tr>
            <tr v-for="ride in rides" :key="ride.id" class="hover:bg-background/30 transition-colors">
              <td class="px-6 py-4">
                <div class="flex items-center space-x-2">
                  <div class="flex flex-col items-center mr-2">
                    <div class="w-2 h-2 rounded-full bg-primary"></div>
                    <div class="w-0.5 h-3 bg-border my-0.5"></div>
                    <div class="w-2 h-2 rounded-full bg-secondary"></div>
                  </div>
                  <div>
                    <p class="font-bold text-text">{{ ride.departure_location }}</p>
                    <p class="font-bold text-text">{{ ride.arrival_location }}</p>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <p class="text-text font-medium">{{ new Date(ride.departure_date).toLocaleDateString('fr-FR') }}</p>
                <p class="text-xs text-textLight">{{ ride.departure_time?.substring(0, 5) }}</p>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center text-text">
                  <Icon name="ph:users" class="mr-1 text-textMuted" />
                  {{ ride.seats_available }} / {{ ride.total_seats }}
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="font-bold text-primary">{{ ride.price_per_seat }} FCFA</span>
              </td>
              <td class="px-6 py-4">
                <span 
                  class="px-2.5 py-1 text-xs font-medium rounded-full"
                  :class="{
                    'bg-success/10 text-success': ride.status === 'active',
                    'bg-textLight/10 text-textLight': ride.status === 'completed',
                    'bg-error/10 text-error': ride.status === 'cancelled'
                  }"
                >
                  {{ ride.status === 'active' ? 'Actif' : ride.status === 'completed' ? 'Terminé' : 'Annulé' }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <button class="p-1 text-textLight hover:text-primary transition-colors" title="Détails">
                  <Icon name="ph:eye" class="w-5 h-5" />
                </button>
                <button class="p-1 text-textLight hover:text-error transition-colors ml-2" title="Supprimer">
                  <Icon name="ph:trash" class="w-5 h-5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="p-4 border-t border-border flex items-center justify-between text-sm text-textLight">
        <span>Affichage de {{ rides.length }} résultats</span>
        <div class="flex space-x-1">
          <button class="px-3 py-1 rounded-md border border-border hover:bg-background disabled:opacity-50" disabled>Précédent</button>
          <button class="px-3 py-1 rounded-md border border-border hover:bg-background">Suivant</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const { fetchApi } = useApi()
const rides = ref<any[]>([])
const pending = ref(true)

onMounted(async () => {
  try {
    const data = await fetchApi<any[]>('/rides/')
    rides.value = data
  } catch (err) {
    console.error('Erreur chargement trajets', err)
  } finally {
    pending.value = false
  }
})
</script>
