import { ref } from 'vue'

export const useNotifications = () => {
  const { fetchApi } = useApi()
  const notifications = ref<any[]>([])
  const users = ref<any[]>([])
  const pending = ref(true)

  const fetchNotifications = async () => {
    pending.value = true
    try {
      const [notifData, userData] = await Promise.all([
        fetchApi<any[]>('/notifications/'),
        fetchApi<any[]>('/users/')
      ])
      
      const rawNotifications = Array.isArray(notifData) ? notifData : (notifData as any).results || []
      const rawUsers = Array.isArray(userData) ? userData : (userData as any).results || []
      
      // Tri des notifications : les plus récentes en premier
      notifications.value = rawNotifications.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      users.value = rawUsers
    } catch (err) {
      console.error('Erreur fetching notifications', err)
    } finally {
      pending.value = false
    }
  }

  const sendNotification = async (payload: any) => {
    return await fetchApi('/notifications/', {
      method: 'POST',
      body: payload
    })
  }

  const deleteNotification = async (id: string | number) => {
    return await fetchApi(`/notifications/${id}/`, {
      method: 'DELETE'
    })
  }

  return {
    notifications,
    users,
    pending,
    fetchNotifications,
    sendNotification,
    deleteNotification
  }
}
