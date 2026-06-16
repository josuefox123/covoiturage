import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function HelpCenterScreen() {
  const router = useRouter();

  const faqs = [
    { q: "Comment réserver un trajet ?", a: "Recherchez un trajet sur la page d'accueil, sélectionnez celui qui vous convient et cliquez sur Réserver." },
    { q: "Comment publier un trajet ?", a: "Allez dans l'onglet 'Publier', entrez les détails de votre départ, arrivée, date et heure, puis validez." },
    { q: "Comment suis-je remboursé si j'annule ?", a: "L'annulation gratuite est possible jusqu'à 24h avant le départ. Passé ce délai, des frais s'appliquent." },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Centre d'aide</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <Ionicons name="help-buoy-outline" size={64} color={theme.colors.primary} />
          <Text style={styles.heroTitle}>Comment pouvons-nous vous aider ?</Text>
          <Text style={styles.heroSubtitle}>Trouvez des réponses rapides à vos questions.</Text>
        </View>

        <Text style={styles.sectionTitle}>Questions fréquentes</Text>
        
        {faqs.map((faq, index) => (
          <View key={index} style={styles.faqCard}>
            <Text style={styles.question}>{faq.q}</Text>
            <Text style={styles.answer}>{faq.a}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.contactBtn} onPress={() => router.push('/contact')}>
          <Text style={styles.contactBtnText}>Je ne trouve pas ma réponse</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  heroSection: { alignItems: 'center', marginBottom: 32, marginTop: 16 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 16, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 16 },
  faqCard: {
    backgroundColor: theme.colors.white,
    padding: 16, borderRadius: 12, marginBottom: 12,
    shadowColor: theme.colors.black, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2
  },
  question: { fontSize: 15, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  answer: { fontSize: 14, color: theme.colors.textLight, lineHeight: 20 },
  contactBtn: {
    backgroundColor: theme.colors.primaryLight, padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 24,
  },
  contactBtnText: { color: theme.colors.primary, fontSize: 15, fontWeight: '700' }
});
