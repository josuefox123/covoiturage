/**
 * ==============================================================
 * Fichier :
 * useNotifications.ts
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
/**
 * Hook pour la gestion des notifications push (FCM via Expo Notifications).
 *
 * Usage dans _layout.tsx :
 *   const { expoPushToken } = useNotifications();
 *
 * ⚠️  Les notifications FCM en arrière-plan nécessitent un Dev Build.
 *     Dans Expo Go, seules les notifications en premier plan fonctionnent.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, Alert, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { CustomAlert } from '../utils/CustomAlert';
import { API_URL } from '../services/api';
import { wsService } from '../services/websocket/WebSocketService';
import * as Speech from 'expo-speech';

import Constants, { ExecutionEnvironment } from 'expo-constants';

// Import conditionnel de expo-notifications pour mobile (Expo Go & Dev Build & Standalone)
let Notifications: any = null;
let Device: any = null;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
  } catch (e) {
    console.warn('[Notifications] Module expo-notifications non disponible:', e);
  }
}

// Configuration de l'affichage des notifications en premier plan
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Hook useNotifications.
 *
 * Gère la logique métier et l'état local.
 */
export function useNotifications() {
  const { token, authFetch } = useAuth();
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const activeProposalAlerts = useRef<Set<string>>(new Set());

  const registerForPushNotifications = useCallback(async () => {
    if (!Notifications || !Device) {
      console.warn('[Notifications] Module expo-notifications non disponible');
      return null;
    }

    // Les notifications push physiques nécessitent un vrai appareil
    if (!Device.isDevice) {
      console.warn('[Notifications] Notifications push non disponibles sur simulateur');
      return null;
    }

    // Demander la permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission refusée');
      setPermissionGranted(false);
      return null;
    }

    setPermissionGranted(true);

    // Canal Android haute priorité Zemy
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Alertes Zemy',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500, 250, 500],
        lightColor: '#0066FF',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    if (isExpoGo) {
      return null;
    }

    // Récupérer le token Push (Expo Push Token ou FCM Device Token)
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || "7befcd51-2b86-4b54-a963-80ffb264a743";
      let pushToken: string | null = null;
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        pushToken = tokenData?.data || null;
      } catch (e1) {
        try {
          const nativeTokenData = await Notifications.getDevicePushTokenAsync();
          pushToken = nativeTokenData?.data || null;
        } catch (e2) {
          console.warn('[Notifications] Impossible d\'obtenir le push token:', e1);
        }
      }
      if (pushToken) {
        setExpoPushToken(pushToken);
        return pushToken;
      }
    } catch (e) {
      console.warn('[Notifications] Erreur récupération token push:', e);
    }
    return null;
  }, []);

  const saveFcmTokenToBackend = useCallback(async (pushToken: string) => {
    if (!token) return; // Non authentifié
    try {
      await authFetch('/auth/fcm-token/', {
        method: 'POST',
        body: JSON.stringify({ fcm_token: pushToken }),
      });
    } catch (e) {
      console.error('[Notifications] Erreur enregistrement FCM token:', e);
    }
  }, [token, authFetch]);

  // Initialiser les notifications quand l'utilisateur est authentifié
  useEffect(() => {
    if (!token) {
      wsService.disconnect();
      return;
    }

    // Connecter le WebSocket direct pour les notifications 0ms en direct
    wsService.connect(token, API_URL);

    if (!Notifications) return;

    let mounted = true;

    (async () => {
      const pushToken = await registerForPushNotifications();
      if (pushToken && mounted) {
        await saveFcmTokenToBackend(pushToken);
      }
    })();

    return () => { mounted = false; };
  }, [token, registerForPushNotifications, saveFcmTokenToBackend]);

  // Listeners pour les notifications reçues/cliquées
  useEffect(() => {
    if (!Notifications) return;

    // Notification reçue en premier plan (affichée)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: any) => {
        const data = notification.request.content.data;
        const title = notification.request.content.title || '';
        const body = notification.request.content.body || '';

        // Liste des types importants nécessitant une annonce vocale
        const speakTypes = [
          'new_booking_request',
          'booking_accepted_passenger',
          'passenger_paid_driver',
          'passenger_refused_offer',
          'leg_seats_freed_driver',
          'booking_cancelled',
          'booking_expired'
        ];
        
        if (data?.type && speakTypes.includes(data.type)) {
          try {
            Speech.speak(body || title, { language: 'fr' });
          } catch (e) {
            console.warn("TTS Error:", e);
          }
        }

        if (data?.type === 'new_booking_request') {
          DeviceEventEmitter.emit('showBookingRequest', {
            id: data.booking_id,
            departure_location: data.departure_location || '',
            arrival_location: data.arrival_location || '',
            seats_booked: parseInt(data.seats_booked || '1'),
            total_amount: parseInt(data.total_amount || '0'),
            created_at: data.created_at || new Date().toISOString(),
            negotiation_message: data.negotiation_message || '',
            passenger_details: {
              full_name: data.passenger_name || 'Passager',
              phone: data.passenger_phone || ''
            }
          });
        } else if (data?.type === 'booking_accepted_passenger') {
          // Ne pas afficher d'alerte pop-up bloquante OUI/NON globale ici.
          // La synthèse vocale TTS et le bandeau de push standard suffisent.
          // L'utilisateur pourra accepter/décliner en ouvrant le trajet.
          DeviceEventEmitter.emit('refreshRideDetails');
          if (data?.ride_id) {
            rideEventBus.emit({
              type: 'SessionReloadRequested',
              rideId: String(data.ride_id),
              bookingId: data.booking_id ? String(data.booking_id) : undefined,
              timestamp: Date.now()
            });
          }
        }
      }
    );

    // Utilisateur clique sur une notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response.notification.request.content.data;

        if (data?.type === 'new_booking_request') {
          DeviceEventEmitter.emit('showBookingRequest', {
            id: data.booking_id,
            departure_location: data.departure_location || '',
            arrival_location: data.arrival_location || '',
            seats_booked: parseInt(data.seats_booked || '1'),
            total_amount: parseInt(data.total_amount || '0'),
            created_at: data.created_at || new Date().toISOString(),
            negotiation_message: data.negotiation_message || '',
            passenger_details: {
              full_name: data.passenger_name || 'Passager',
              phone: data.passenger_phone || ''
            }
          });
        }

        // Deep linking vers la bonne page
        if (data?.screen === 'chat' && data?.conversation_id) {
          router.push(`/chat/${data.conversation_id}`);
        } else if (data?.screen === 'trips' && data?.booking_id) {
          router.push(`/(tabs)/trips`);
        } else if (data?.screen === 'rides' && data?.ride_id) {
          router.push(`/(tabs)/rides`);
        } else if (data?.screen === 'rides') {
          router.push(`/(tabs)/rides`);
        } else if (data?.screen === 'trips') {
          router.push(`/(tabs)/trips`);
        } else if (data?.ride_id) {
          router.push(`/ride/${data.ride_id}`);
        } else if (data?.screen === 'notifications') {
          router.push('/notifications');
        } else if (data?.screen === 'home') {
          router.push('/(tabs)/home');
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  // Polling silencieux pour afficher les nouvelles notifications directement dans l'app en temps réel
  const lastSeenNotifId = useRef<string | number | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const notifs = await authFetch(`/notifications/?_t=${Date.now()}`);
        const list = Array.isArray(notifs) ? notifs : notifs?.results || [];
        if (list.length > 0 && isMounted) {
          const latest = list[0];
          if (lastSeenNotifId.current === null) {
            lastSeenNotifId.current = latest.id;
          } else if (latest.id !== lastSeenNotifId.current && !latest.is_read) {
            lastSeenNotifId.current = latest.id;
            
            let dataObj: any = {};
            if (latest.data) {
              try {
                dataObj = typeof latest.data === 'string' ? JSON.parse(latest.data) : latest.data;
              } catch (e) {
                dataObj = {};
              }
            }

            // Liste des types importants nécessitant une annonce vocale
            const speakTypes = [
              'new_booking_request',
              'booking_accepted_passenger',
              'passenger_paid_driver',
              'passenger_refused_offer',
              'leg_seats_freed_driver',
              'booking_cancelled',
              'booking_expired'
            ];
            
            if (dataObj?.type && speakTypes.includes(dataObj.type)) {
              try {
                Speech.speak(latest.message || latest.title, { language: 'fr' });
              } catch (e) {
                console.warn("TTS Error:", e);
              }
            }

            if (dataObj?.type === 'booking_accepted_passenger') {
              // Ne pas afficher d'alerte pop-up bloquante OUI/NON globale ici.
              // La synthèse vocale TTS (déjà déclenchée au-dessus) et le bandeau de push standard suffisent.
              DeviceEventEmitter.emit('refreshRideDetails');
            } else if (dataObj?.type === 'new_booking_request') {
              DeviceEventEmitter.emit('showBookingRequest', {
                id: dataObj.booking_id,
                departure_location: dataObj.departure_location || '',
                arrival_location: dataObj.arrival_location || '',
                seats_booked: parseInt(dataObj.seats_booked || '1'),
                total_amount: parseInt(dataObj.total_amount || '0'),
                created_at: dataObj.created_at || new Date().toISOString(),
                negotiation_message: dataObj.negotiation_message || '',
                passenger_details: {
                  full_name: dataObj.passenger_name || 'Passager',
                  phone: dataObj.passenger_phone || ''
                }
              });
            } else {
              CustomAlert.alert(
                latest.title || 'Nouvelle notification 🔔',
                latest.message || ''
              );
            }
          }
        }
      } catch (e) {
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, authFetch]);

  return {
    expoPushToken,
    permissionGranted,
    registerForPushNotifications,
  };
}
