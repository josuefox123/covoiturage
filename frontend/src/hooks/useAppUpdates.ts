/**
 * ==============================================================
 * Fichier : useAppUpdates.ts
 *
 * Description :
 * Hook de vérification et d'application des mises à jour Over-The-Air (EAS Update).
 * Vérifie les mises à jour au démarrage et lors du retour au premier plan.
 * Affiche l'alerte pop-up demandée à l'utilisateur et applique la mise à jour instantanément.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

export function useAppUpdates() {
  const isChecking = useRef(false);

  useEffect(() => {
    async function checkUpdate() {
      if (__DEV__ || !Updates.isEnabled || isChecking.current) return;
      isChecking.current = true;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            'Mise à jour disponible 🚀',
            'Une nouvelle version de Zemy est disponible !',
            [
              { text: 'Plus tard', style: 'cancel' },
              {
                text: 'Mettre à jour maintenant',
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (err) {
                    console.warn('[Updates] Erreur lors du téléchargement:', err);
                  }
                },
              },
            ],
            { cancelable: true }
          );
        }
      } catch (error) {
        console.log('[Updates] Erreur vérification mise à jour:', error);
      } finally {
        isChecking.current = false;
      }
    }

    checkUpdate();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkUpdate();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
