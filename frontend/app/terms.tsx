import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conditions d'utilisation</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Conditions Générales</Text>
        <Text style={styles.lastUpdated}>Dernière mise à jour : Mai 2026</Text>

        <Text style={styles.sectionTitle}>1. Acceptation des conditions</Text>
        <Text style={styles.paragraph}>
          En utilisant l'application Zemy, vous acceptez de vous conformer à nos conditions générales d'utilisation. Si vous n'êtes pas d'accord, veuillez ne pas utiliser nos services.
        </Text>

        <Text style={styles.sectionTitle}>2. Utilisation du service</Text>
        <Text style={styles.paragraph}>
          L'application est destinée à la mise en relation de conducteurs et passagers pour du covoiturage. Les utilisateurs doivent fournir des informations exactes lors de leur inscription.
        </Text>

        <Text style={styles.sectionTitle}>3. Responsabilités</Text>
        <Text style={styles.paragraph}>
          Zemy agit uniquement comme un intermédiaire. Nous ne saurions être tenus responsables des incidents pouvant survenir durant les trajets. Chaque conducteur est responsable de son véhicule et de sa conduite.
        </Text>

        <Text style={styles.sectionTitle}>4. Vérification d'identité</Text>
        <Text style={styles.paragraph}>
          Pour garantir la sécurité de la communauté, les conducteurs doivent soumettre leur pièce d'identité et permis de conduire. Les passagers sont également invités à vérifier leur compte.
        </Text>

        <Text style={styles.sectionTitle}>5. Modification des conditions</Text>
        <Text style={styles.paragraph}>
          Nous nous réservons le droit de modifier ces conditions à tout moment. Vous serez notifié des changements majeurs.
        </Text>

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
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
  lastUpdated: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginTop: 16, marginBottom: 8 },
  paragraph: { fontSize: 14, color: theme.colors.textLight, lineHeight: 22, textAlign: 'justify' },
});
