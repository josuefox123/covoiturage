/**
 * ==============================================================
 * BadgeContext.tsx
 *
 * Contexte global pour les compteurs de badges de la tab bar.
 * - notifCount  : nombre de notifications non lues
 * - tripCount   : nombre de trajets / réservations nécessitant une action
 * - messageCount: nombre de messages non lus
 *
 * Utilisation :
 *   const { notifCount, tripCount, messageCount, refresh } = useBadges();
 * ==============================================================
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';

/** Statuts de réservation qui nécessitent une action immédiate du passager */
const PASSENGER_ACTION_STATUSES = new Set([
  'pending_payment',
  'pending_passenger',
  'offer_received',
]);

/** Statuts de réservation qui nécessitent une action du conducteur */
const DRIVER_ACTION_STATUSES = new Set(['pending', 'pending_driver']);

interface BadgeContextValue {
  notifCount: number;
  tripCount: number;
  messageCount: number;
  refresh: () => void;
}

const BadgeContext = createContext<BadgeContextValue>({
  notifCount: 0,
  tripCount: 0,
  messageCount: 0,
  refresh: () => {},
});

const POLL_INTERVAL_MS = 30_000; // toutes les 30 secondes

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { authFetch, token, user } = useAuth();

  const [notifCount, setNotifCount] = useState(0);
  const [tripCount, setTripCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchBadges = useCallback(async () => {
    if (!token || !user) return;

    try {
      // ─── 1. Notifications non lues ────────────────────────
      const notifData = await authFetch('/notifications/?page_size=50');
      const notifList: any[] = Array.isArray(notifData)
        ? notifData
        : notifData?.results || [];
      const unread = notifList.filter((n: any) => !n.is_read).length;
      setNotifCount(unread);

      // ─── 2. Trajets nécessitant une action ────────────────
      const [bookingsData, ridesData] = await Promise.all([
        authFetch(`/bookings/?passenger=${user.id}&page_size=50`),
        authFetch(`/rides/?driver=${user.id}&status=scheduled&page_size=50`),
      ]);

      const bookings: any[] = Array.isArray(bookingsData)
        ? bookingsData
        : bookingsData?.results || [];
      const rides: any[] = Array.isArray(ridesData)
        ? ridesData
        : ridesData?.results || [];

      // Réservations passager avec action à faire
      const passengerActionCount = bookings.filter((b: any) =>
        PASSENGER_ACTION_STATUSES.has(String(b.status || b.action))
      ).length;

      // Réservations reçues sur les trajets conducteur avec action à faire
      const driverActionCount = rides.reduce((acc: number, ride: any) => {
        const pendingBookings: any[] = (ride.bookings || []).filter((b: any) =>
          DRIVER_ACTION_STATUSES.has(String(b.status))
        );
        return acc + pendingBookings.length;
      }, 0);

      setTripCount(passengerActionCount + driverActionCount);

      // ─── 3. Messages non lus ──────────────────────────────
      const convsData = await authFetch('/conversations/?page_size=50');
      const convsList: any[] = Array.isArray(convsData)
        ? convsData
        : convsData?.results || [];
      const unreadMsgs = convsList.reduce(
        (acc: number, c: any) => acc + (c.unread_count || 0),
        0
      );
      setMessageCount(unreadMsgs);
    } catch (_e) {
      // Silencieux – pas de spam d'erreurs en arrière-plan
    }
  }, [authFetch, token, user]);

  // Lancement du polling + écoute AppState
  useEffect(() => {
    if (!token) {
      setNotifCount(0);
      setTripCount(0);
      setMessageCount(0);
      return;
    }

    // Premier fetch immédiat
    fetchBadges();

    // Polling périodique
    timerRef.current = setInterval(fetchBadges, POLL_INTERVAL_MS);

    // Rafraîchir à chaque retour en premier plan
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        fetchBadges();
      }
      appStateRef.current = next;
    });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [token, fetchBadges]);

  return (
    <BadgeContext.Provider
      value={{ notifCount, tripCount, messageCount, refresh: fetchBadges }}
    >
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadges() {
  return useContext(BadgeContext);
}
