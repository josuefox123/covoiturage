/**
 * ==============================================================
 * Fichier :
 * transactions.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { theme } from '../src/styles/theme';

/**
 * Composant TransactionsScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à TransactionsScreen.
 */
export default function TransactionsScreen() {
  const router = useRouter();
  const { authFetch } = useAuth();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await authFetch('/transactions/');
      setTransactions(Array.isArray(data) ? data : data.results || []);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const getTransactionIcon = useCallback((type: string) => {
    if (type === 'ride') return <Ionicons name="car-sport" size={28} color={theme.colors.primary} />;
    if (type === 'withdrawal') return <Ionicons name="arrow-up-circle" size={28} color={'#EF4444'} />;
    if (type === 'refund') return <Ionicons name="arrow-undo-circle" size={28} color={theme.colors.warning} />;
    return <Ionicons name="wallet" size={28} color={theme.colors.textLight} />;
  }, []);

  const getTransactionLabel = useCallback((type: string) => {
    if (type === 'ride') return 'Revenus Trajet';
    if (type === 'withdrawal') return 'Retrait';
    if (type === 'refund') return 'Remboursement';
    return 'Transaction';
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        {getTransactionIcon(item.transaction_type)}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{getTransactionLabel(item.transaction_type)}</Text>
        <Text style={styles.cardDate}>
          {new Date(item.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </Text>
      </View>
      <View style={styles.cardAmount}>
        <Text style={[
          styles.amountText,
          item.transaction_type === 'withdrawal' || item.transaction_type === 'refund' ? styles.amountNegative : styles.amountPositive
        ]}>
          {item.transaction_type === 'withdrawal' || item.transaction_type === 'refund' ? '-' : '+'}{item.amount} FCFA
        </Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  ), [getTransactionIcon, getTransactionLabel]);

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portefeuille</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && transactions.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="wallet-outline" size={60} color={theme.colors.border} />
          <Text style={styles.emptyText}>Aucune transaction pour le moment</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchTransactions}
          refreshing={loading}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 16, textAlign: 'center' },
  listContent: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIcon: { marginRight: 12 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  cardDate: { fontSize: 12, color: '#6B7280' },
  cardAmount: { alignItems: 'flex-end' },
  amountText: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  amountPositive: { color: '#10B981' },
  amountNegative: { color: '#EF4444' },
  statusBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },
});
