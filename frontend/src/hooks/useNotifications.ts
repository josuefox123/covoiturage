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
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { CustomAlert } from '../utils/CustomAlert';

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

    // Dans Expo Go (SDK 53+), Expo neutralise getExpoPushTokenAsync et lève une erreur rouge.
    // En mode Standalone APK ou Dev Build, le token push est généré normalement.
    if (isExpoGo) {
      return null;
    }

    // Récupérer le token Expo Push (uniquement sur Dev Build / Build APK)
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || "7befcd51-2b86-4b54-a963-80ffb264a743";
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      const pushToken = tokenData.data;
      setExpoPushToken(pushToken);
      return pushToken;
    } catch (e) {
      return null;
    }
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
    if (!token || !Notifications) return;

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
      }
    );

    // Utilisateur clique sur une notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response.notification.request.content.data;

        // Deep linking vers la bonne page
        if (data?.screen === 'chat' && data?.conversation_id) {
          router.push(`/chat/${data.conversation_id}`);
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
            CustomAlert.alert(
              latest.title || 'Nouvelle notification 🔔',
              latest.message || ''
            );
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
