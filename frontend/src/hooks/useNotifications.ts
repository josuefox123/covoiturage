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

import Constants, { ExecutionEnvironment } from 'expo-constants';

// Import conditionnel pour éviter les crashs sur web/Expo Go (SDK 53/54 rejettent les pushs dans Expo Go)
let Notifications: any = null;
let Device: any = null;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    Device = require('expo-device');
  } catch (e) {
  }
} else {
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

    // Canal Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Zemy Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: true,
        enableVibrate: true,
      });
    }

    // Récupérer le token Expo Push (encapsule le FCM token)
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // Utilisera le projectId de app.json si défini
      });
      const pushToken = tokenData.data;
      setExpoPushToken(pushToken);
      return pushToken;
    } catch (e) {
      console.error('[Notifications] Erreur récupération token:', e);
      // Fallback: essayer de récupérer le FCM token natif directement
      try {
        const nativeToken = await Notifications.getDevicePushTokenAsync();
        setExpoPushToken(nativeToken.data);
        return nativeToken.data;
      } catch (e2) {
        console.error('[Notifications] Erreur FCM token natif:', e2);
        return null;
      }
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

  return {
    expoPushToken,
    permissionGranted,
    registerForPushNotifications,
  };
}
