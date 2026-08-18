/**
 * earnings.service.ts
 *
 * Service API pour les gains et reversements conducteur.
 * Zemy — Frontend
 */
import { fetchApi } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface EarningsSummary {
  gross_amount: number;
  zemy_commission: number;
  driver_amount: number;
  already_paid: number;
  in_processing: number;
  available_balance: number;
}

export interface RideEarning {
  ride_id: string;
  departure_location: string;
  arrival_location: string;
  departure_date: string;
  bookings_count: number;
  gross_amount: number;
  driver_amount: number;
  zemy_commission: number;
  payment_status: string;
  payouts: PayoutItem[];
}

export interface PayoutItem {
  payout_id: string;
  reference: string | null;
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled';
  operator: string;
  phone_number: string;
  requested_at: string | null;
  paid_at: string | null;
}

export interface DriverEarningsResponse {
  summary: EarningsSummary;
  history: RideEarning[];
  payout_automatic_enabled: boolean;
}

export interface ClaimPayoutPayload {
  amount: number;
  phone_number: string;
  operator: 'mtn' | 'moov' | 'celtiis' | 'other';
}

export interface ClaimPayoutResponse {
  success: boolean;
  payout_id: string;
  payout_reference: string;
  amount: number;
  phone_number: string;
  operator: string;
  payment_mode: string;
  status: string;
  message: string;
}

// ---------------------------------------------------------------
// Helper auth headers
// ---------------------------------------------------------------

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------
// API calls
// ---------------------------------------------------------------

/**
 * Récupère le solde et l'historique des gains du conducteur.
 */
export async function fetchDriverEarnings(): Promise<DriverEarningsResponse> {
  const headers = await getAuthHeaders();
  return fetchApi('/driver/earnings/', { method: 'GET', headers });
}

/**
 * Soumet une demande de retrait partiel ou total.
 */
export async function claimPayout(payload: ClaimPayoutPayload): Promise<ClaimPayoutResponse> {
  const headers = await getAuthHeaders();
  return fetchApi('/driver/claim/', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

/**
 * Récupère la liste des payouts du conducteur.
 */
export async function fetchDriverPayouts(): Promise<{ payouts: PayoutItem[]; count: number }> {
  const headers = await getAuthHeaders();
  return fetchApi('/driver/payouts/', { method: 'GET', headers });
}

/**
 * Récupère le détail d'un payout par son ID.
 */
export async function fetchPayoutDetail(payoutId: string): Promise<any> {
  const headers = await getAuthHeaders();
  return fetchApi(`/driver/payouts/${payoutId}/`, { method: 'GET', headers });
}
