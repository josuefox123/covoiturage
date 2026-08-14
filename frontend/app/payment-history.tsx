/**
 * ==============================================================
 * Fichier :
 * payment-history.tsx
 *
 * Description :
 * Historique des paiements de l'utilisateur Zemy.
 * Chaque paiement peut générer et télécharger un reçu PDF Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../src/context/AuthContext';
import { theme } from '../src/styles/theme';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';

const API_BASE = 'https://zemy.erika-app.com/api';

interface PaymentItem {
  id: string;
  transaction_id: string;
  amount: number;
  status: string;
  provider: string;
  service_type: 'ride' | 'parcel' | 'other';
  service_label: string;
  departure_location: string | null;
  arrival_location: string | null;
  departure_date: string | null;
  created_at: string;
  booking_id?: string | null;
  booking_status?: string | null;
  driver_id?: string | null;
  has_refund_request?: boolean;
}

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { authFetch, user } = useAuth();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await authFetch('/payments/my-history/');
      setPayments(Array.isArray(data) ? data : (data?.results ?? []));
    } catch (e) {
      console.error('Erreur chargement historique paiements', e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [authFetch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const downloadReceipt = async (payment: PaymentItem) => {
    try {
      setDownloadingId(payment.id);

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (!isSharingAvailable) {
        Alert.alert('Non disponible', "Le partage de fichiers n'est pas disponible sur cet appareil.");
        return;
      }

      const storedToken = await SecureStore.getItemAsync('zemy_access_token');
      const receiptUrl = `${API_BASE}/payments/${payment.id}/receipt/`;
      const localUri = (((FileSystem as any).documentDirectory) ?? '') + `recu_zemy_${payment.transaction_id.substring(0, 12)}.pdf`;

      const downloadResult = await FileSystem.downloadAsync(receiptUrl, localUri, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
      });

      if (downloadResult.status === 200) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Reçu de paiement Zemy',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Erreur', 'Impossible de télécharger le reçu. Veuillez réessayer.');
      }
    } catch (e: any) {
      console.error('Erreur téléchargement reçu:', e);
      Alert.alert('Erreur', 'Impossible de générer le reçu. Veuillez réessayer.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRequestRefund = async (payment: PaymentItem) => {
    if (!payment.booking_id) return;
    
    Alert.alert(
      "Confirmer la demande",
      "Souhaitez-vous vraiment soumettre une demande de remboursement pour ce trajet annulé ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Confirmer", 
          onPress: async () => {
            try {
              // Créer une demande de remboursement
              await authFetch('/refund-requests/', {
                method: 'POST',
                body: JSON.stringify({
                  booking: payment.booking_id,
                  passenger: user?.id,
                  driver: payment.driver_id,
                  amount: payment.amount,
                  reason: "Trajet annulé par le passager ou le conducteur. Demande automatique."
                })
              });
              
              Alert.alert("Demande soumise", "Votre demande de remboursement a été enregistrée avec succès. Un administrateur va l'examiner.");
              fetchHistory();
            } catch (err: any) {
              console.error('Erreur demande remboursement:', err);
              Alert.alert("Erreur", err.message || "Impossible de soumettre la demande de remboursement.");
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const renderItem = ({ item }: { item: PaymentItem }) => (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      {/* Service icon + header */}
      <View style={styles.cardHeader}>
        <View style={styles.iconWrapper}>
          {item.service_type === 'ride' ? (
            <LinearGradient colors={['#16A34A', '#15803D']} style={styles.iconGradient}>
              <Ionicons name="car-sport" size={22} color="white" />
            </LinearGradient>
          ) : item.service_type === 'parcel' ? (
            <LinearGradient colors={['#7C3AED', '#6D28D9']} style={styles.iconGradient}>
              <Ionicons name="cube-outline" size={22} color="white" />
            </LinearGradient>
          ) : (
            <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.iconGradient}>
              <Ionicons name="wallet-outline" size={22} color="white" />
            </LinearGradient>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.serviceLabel} numberOfLines={1}>{item.service_label}</Text>
          <Text style={styles.cardDate}>{formatDate(item.created_at)} · {formatTime(item.created_at)}</Text>
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.amountText}>{item.amount.toLocaleString('fr-FR')} F</Text>
          <View style={styles.statusBadge}>
            <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
            <Text style={styles.statusText}>Payé</Text>
          </View>
        </View>
      </View>

      {/* Separator */}
      <View style={styles.cardDivider} />

      {/* Footer row — Ref + Download / Refund */}
      <View style={styles.cardFooter}>
        <View style={styles.refBlock}>
          <Ionicons name="receipt-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.refText} numberOfLines={1}>
            {item.transaction_id.length > 18
              ? item.transaction_id.substring(0, 18) + '…'
              : item.transaction_id}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {item.service_type === 'ride' && ['cancelled', 'rejected', 'expired', 'payment_failed'].includes(item.booking_status || '') && (
            item.has_refund_request ? (
              <View style={styles.refundPendingBadge}>
                <Ionicons name="time-outline" size={13} color="#D97706" />
                <Text style={styles.refundPendingText}>En cours</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.refundActionBtn}
                onPress={() => handleRequestRefund(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-undo-outline" size={13} color="#FFFFFF" />
                <Text style={styles.refundActionText}>Rembourser</Text>
              </TouchableOpacity>
            )
          )}

          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={() => downloadReceipt(item)}
            disabled={downloadingId === item.id}
            activeOpacity={0.75}
          >
            {downloadingId === item.id ? (
              <ActivityIndicator size="small" color="#16A34A" />
            ) : (
              <>
                <Ionicons name="download-outline" size={15} color="#16A34A" />
                <Text style={styles.downloadText}>Reçu PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  const totalSpent = payments.reduce((s, p) => s + p.amount, 0);
  const rideCount = payments.filter(p => p.service_type === 'ride').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Historique des paiements</Text>
          <Text style={styles.headerSub}>Vos transactions Zemy</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : payments.length === 0 ? (
        <View style={styles.centered}>
          <LinearGradient colors={['#F0FDF4', '#DCFCE7']} style={styles.emptyIcon}>
            <Ionicons name="receipt-outline" size={48} color="#16A34A" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>Aucun paiement</Text>
          <Text style={styles.emptyText}>
            Vos paiements complétés apparaîtront ici.{'\n'}Réservez un trajet pour commencer !
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/home')}>
            <LinearGradient colors={['#16A34A', '#15803D']} style={styles.emptyBtnGradient}>
              <Text style={styles.emptyBtnText}>Explorer les trajets</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Summary bar */}
          <LinearGradient colors={['#F0FDF4', '#FFFFFF']} style={styles.summaryBar}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{payments.length}</Text>
              <Text style={styles.summaryLabel}>Paiements</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{totalSpent.toLocaleString('fr-FR')} F</Text>
              <Text style={styles.summaryLabel}>Total dépensé</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{rideCount}</Text>
              <Text style={styles.summaryLabel}>Trajets payés</Text>
            </View>
          </LinearGradient>

          <FlatList
            data={payments}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 14,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyBtnGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16A34A',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  // List
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  iconGradient: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  serviceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cardDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  amountBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  refBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  refText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    minWidth: 100,
    justifyContent: 'center',
  },
  downloadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
  },
  refundPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  refundPendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  refundActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
  },
  refundActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
