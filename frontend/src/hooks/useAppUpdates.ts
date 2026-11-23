/**
 * ==============================================================
 * Fichier : useAppUpdates.ts
 *
 * Description :
 * Hook de vérification et d'application des mises à jour Over-The-Air (EAS Update).
 * - Vérifie les mises à jour au démarrage et au retour au premier plan.
 * - Gère l'état pour afficher la modale personnalisée et la page de chargement (0-100%).
 * - Applique la mise à jour proprement sans coupure brutale.
 *
 * Projet : Zemy
 * ==============================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

export interface AppUpdateState {
  isAvailable: boolean;
  isDownloading: boolean;
  progress: number;
  statusText: string;
  error: string | null;
  startUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  retryUpdate: () => Promise<void>;
}

export function useAppUpdates(): AppUpdateState {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isChecking = useRef(false);
  const progressInterval = useRef<any>(null);

  // Vérification de la disponibilité d'une mise à jour
  const checkUpdate = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || isChecking.current || isDownloading) return;
    isChecking.current = true;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setIsAvailable(true);
      }
    } catch (err) {
      console.log('[Updates] Erreur lors de la vérification:', err);
    } finally {
      isChecking.current = false;
    }
  }, [isDownloading]);

  useEffect(() => {
    checkUpdate();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkUpdate();
      }
    });

    return () => {
      subscription.remove();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [checkUpdate]);

  // Lancement du téléchargement avec barre de progression de 0 à 100%
  const startUpdate = useCallback(async () => {
    setIsDownloading(true);
    setError(null);
    setProgress(5);
    setStatusText('Connexion aux serveurs Zemy...');

    let currentProgress = 5;

    // Simulation d'une montée progressive fluide pendant le téléchargement réseau
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      if (currentProgress < 85) {
        currentProgress += Math.floor(Math.random() * 5) + 3;
        if (currentProgress > 85) currentProgress = 85;
        setProgress(currentProgress);

        if (currentProgress < 30) {
          setStatusText('Connexion aux serveurs Zemy...');
        } else if (currentProgress < 65) {
          setStatusText('Téléchargement des nouveaux modules...');
        } else {
          setStatusText('Vérification et application des fichiers...');
        }
      }
    }, 180);

    try {
      // Téléchargement réel du bundle EAS Update
      await Updates.fetchUpdateAsync();

      // Arrêt de l'intervalle et accélération vers 100%
      if (progressInterval.current) clearInterval(progressInterval.current);

      setProgress(95);
      setStatusText('Finalisation des composants...');

      await new Promise((res) => setTimeout(res, 250));

      setProgress(100);
      setStatusText('Mise à jour terminée ! Redémarrage...');

      // Pause visuelle de 600ms pour que l'utilisateur voie la barre à 100%
      await new Promise((res) => setTimeout(res, 600));

      // Redémarrage propre de l'application
      await Updates.reloadAsync();
    } catch (err: any) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      console.warn('[Updates] Erreur de téléchargement:', err);
      setError(
        err?.message ||
          'Une erreur est survenue lors du téléchargement. Veuillez vérifier votre connexion.'
      );
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setIsAvailable(false);
    setIsDownloading(false);
    setProgress(0);
    setError(null);
    if (progressInterval.current) clearInterval(progressInterval.current);
  }, []);

  const retryUpdate = useCallback(async () => {
    await startUpdate();
  }, [startUpdate]);

  return {
    isAvailable,
    isDownloading,
    progress,
    statusText,
    error,
    startUpdate,
    dismissUpdate,
    retryUpdate,
  };
}
