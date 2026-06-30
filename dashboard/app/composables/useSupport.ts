/**
 * ==========================================================
 * Fichier :
 * useSupport.ts
 * 
 * Description :
 * Composable centralisant la logique métier du Centre de Support Zemy.
 * Gère le chargement, la fusion, la recherche debouncée, le polling et l'alarme sonore.
 * 
 * Projet :
 * Zemy
 * ==========================================================
 */

import { ref, shallowRef, computed, watch, onMounted, onUnmounted, markRaw } from 'vue'
import type { Conversation } from '../types/support'
import { useNotificationSound } from './useNotificationSound'

export function useSupport() {
  const { fetchApi } = useApi()
  const { playAlarm } = useNotificationSound()
  const authCookie = useCookie<string | null>('admin_token')

  // --- States ---
  const conversations = shallowRef<Conversation[]>([])
  const selectedConv = ref<Conversation | null>(null)
  const loading = ref(true)
  const isRefreshing = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const debouncedSearchQuery = ref('')
  const adminId = ref<string | null>(null)

  let searchTimeout: ReturnType<typeof setTimeout> | null = null
  let globalPoll: ReturnType<typeof setInterval> | null = null
  let lastUrgentCount = 0

  // --- JWT Decode ---
  const decodeJwt = (token: string) => {
    try {
      const payload = token.split('.')[1]
      return JSON.parse(atob(payload))
    } catch {
      return null
    }
  }

  // --- Debounce Search ---
  watch(searchQuery, (newVal) => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      debouncedSearchQuery.value = newVal
    }, 300)
  })

  // --- Computed ---
  const filteredConversations = computed(() => {
    const q = debouncedSearchQuery.value.toLowerCase().trim()
    if (!q) return conversations.value
    return conversations.value.filter((c) => {
      const name = (c.participant_1_details?.full_name || '').toLowerCase()
      const phone = (c.participant_1_details?.phone || '').toLowerCase()
      return name.includes(q) || phone.includes(q)
    })
  })

  const unreadTotal = computed(() =>
    conversations.value.reduce((acc, c) => acc + (c.unread_count || 0), 0)
  )

  // --- Merge logic (keeps reference intact to avoid visual flickers and scroll loss) ---
  const mergeConversations = (freshData: Conversation[]) => {
    const sorted = [...freshData].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    if (conversations.value.length === 0) {
      conversations.value = sorted
      return
    }

    const existingMap = new Map(conversations.value.map((c) => [c.id, c]))
    const result: Conversation[] = []

    for (const conv of sorted) {
      const existing = existingMap.get(conv.id)
      if (existing) {
        Object.assign(existing, conv)
        result.push(existing)
      } else {
        result.push(conv)
      }
    }

    conversations.value = result

    // Synchroniser la conversation sélectionnée si elle existe
    if (selectedConv.value) {
      const updated = conversations.value.find((c) => c.id === selectedConv.value?.id)
      if (updated) {
        selectedConv.value = updated
      }
    }
  }

  // --- Load Data ---
  const loadConversations = async () => {
    if (isRefreshing.value) return
    isRefreshing.value = true
    error.value = null

    try {
      const data = await fetchApi<any>('/conversations/?type=support')
      const freshData: Conversation[] = Array.isArray(data) ? data : (data.results || [])

      // Alarme si nouveau message urgent
      const currentUrgentCount = freshData.filter((c) => c.has_urgent_unread).length
      if (currentUrgentCount > lastUrgentCount) {
        playAlarm()
      }
      lastUrgentCount = currentUrgentCount

      mergeConversations(freshData)
    } catch (err: any) {
      error.value = 'Erreur lors du chargement des conversations de support.'
      console.error(err)
    } finally {
      loading.value = false
      isRefreshing.value = false
    }
  }

  // --- Polling Controllers ---
  const startPolling = () => {
    if (globalPoll) clearInterval(globalPoll)
    globalPoll = setInterval(loadConversations, 8000)
  }

  const stopPolling = () => {
    if (globalPoll) {
      clearInterval(globalPoll)
      globalPoll = null
    }
  }

  // --- Hooks ---
  onMounted(async () => {
    if (authCookie.value) {
      const decoded = decodeJwt(authCookie.value)
      if (decoded?.user_id) {
        adminId.value = decoded.user_id
      }
    }
    await loadConversations()
    startPolling()
  })

  onUnmounted(() => {
    stopPolling()
    if (searchTimeout) clearTimeout(searchTimeout)
  })

  return {
    conversations,
    selectedConv,
    loading,
    isRefreshing,
    error,
    searchQuery,
    debouncedSearchQuery,
    filteredConversations,
    unreadTotal,
    adminId,
    loadConversations,
    startPolling,
    stopPolling
  }
}
