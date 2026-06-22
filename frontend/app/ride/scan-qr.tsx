/**
 * ==============================================================
 * Fichier :
 * scan-qr.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { CustomAlert } from '../../src/utils/CustomAlert';

const COLORS = {
  primary: '#10B981',
  white: '#FFFFFF',
  background: '#F9FAFB',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
};

/**
 * Composant ScanQRScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à ScanQRScreen.
 */
export default function ScanQRScreen() {
  const { parcelId } = useLocalSearchParams<{ parcelId: string }>();
  const router = useRouter();
  const { authFetch } = useAuth();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (!code.trim()) {
      CustomAlert.alert('Erreur', 'Veuillez entrer le code QR.');
      return;
    }

    try {
      setLoading(true);
      const res = await authFetch(`/parcels/${parcelId}/scan_qr/`, {
        method: 'POST',
        body: JSON.stringify({ qr_data: code.trim() })
      });
      CustomAlert.alert('Succès', res.message || 'Action réussie', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      CustomAlert.alert('Erreur', error.message || 'Code invalide.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scanner le Colis</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <Ionicons name="qr-code-outline" size={100} color={COLORS.primary} style={{ marginBottom: 24 }} />
        
        <Text style={styles.title}>Validation Manuelle (Simulation)</Text>
        <Text style={styles.subtitle}>
          En production, l'appareil photo scannera le code QR. Pour le test, entrez le code de validation reçu par l'expéditeur ou le destinataire.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Entrer le code secret (ex: parcel_...)"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.btn} onPress={handleScan} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.btnText}>Valider</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  input: { width: '100%', height: 50, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 16, marginBottom: 16, fontSize: 16 },
  btn: { width: '100%', height: 50, backgroundColor: COLORS.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
