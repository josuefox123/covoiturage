/**
 * ==============================================================
 * Fichier :
 * terms.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

/**
 * Composant TermsScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à TermsScreen.
 */
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
        <Text style={styles.title}>Conditions Générales d'Utilisation (CGU)</Text>
        <Text style={styles.lastUpdated}>Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</Text>

        <Text style={styles.sectionTitle}>1. Introduction et objet</Text>
        <Text style={styles.paragraph}>
          Bienvenue sur Zemy. Les présentes Conditions Générales d'Utilisation encadrent juridiquement l'utilisation de la plateforme de covoiturage Zemy. 
          En cochant la case « J'accepte les Conditions d'utilisation de Zemy » lors de votre inscription, vous acceptez expressément et sans réserve de vous soumettre aux présentes CGU. 
          Si vous refusez ces conditions, vous ne pourrez pas utiliser nos services.
        </Text>

        <Text style={styles.sectionTitle}>2. Définitions</Text>
        <Text style={styles.paragraph}>
          <Text style={{fontWeight: 'bold'}}>Zemy : </Text> désigne l'application mobile et le service en ligne fournis.{'\n'}
          <Text style={{fontWeight: 'bold'}}>Utilisateur : </Text> désigne toute personne inscrite sur la plateforme (Conducteur ou Passager).{'\n'}
          <Text style={{fontWeight: 'bold'}}>Conducteur : </Text> désigne le membre proposant un trajet sur la plateforme.{'\n'}
          <Text style={{fontWeight: 'bold'}}>Passager : </Text> désigne le membre réservant une place dans le véhicule du Conducteur.{'\n'}
          <Text style={{fontWeight: 'bold'}}>Trajet : </Text> désigne le déplacement partagé entre Conducteur et Passagers moyennant une participation financière.
        </Text>

        <Text style={styles.sectionTitle}>3. Inscription et Compte Utilisateur</Text>
        <Text style={styles.paragraph}>
          L'accès au service de réservation ou de publication nécessite la création d'un compte. Vous vous engagez à fournir des informations exactes, complètes et à jour (nom, prénom, numéro de téléphone, email). 
          Zemy se réserve le droit de suspendre ou supprimer tout compte contenant des informations fausses, frauduleuses ou usurpant l'identité d'un tiers.
        </Text>

        <Text style={styles.sectionTitle}>4. Vérification d'Identité et Sécurité</Text>
        <Text style={styles.paragraph}>
          Afin de garantir un environnement sécurisé, Zemy exige la vérification d'identité (pièce d'identité officielle et photo) pour tous les Utilisateurs. 
          Les Conducteurs doivent impérativement fournir les détails de leur permis de conduire en cours de validité, ainsi que les informations sur le véhicule utilisé. 
          Toute fraude entraînera le bannissement immédiat.
        </Text>

        <Text style={styles.sectionTitle}>5. Obligations du Conducteur</Text>
        <Text style={styles.paragraph}>
          Le Conducteur s'engage à : {'\n'}
          - Être titulaire d'un permis de conduire valide.{'\n'}
          - Posséder une assurance véhicule valide couvrant les passagers.{'\n'}
          - Présenter un véhicule en bon état de fonctionnement et respectant les normes de sécurité.{'\n'}
          - Ne pas publier de trajets dans un but lucratif professionnel (sauf s'il est enregistré comme tel) : la participation financière ne doit couvrir que le partage des frais.{'\n'}
          - Être ponctuel et se rendre au point de départ convenu.{'\n'}
          - Conduire avec prudence, en respectant le code de la route.
        </Text>

        <Text style={styles.sectionTitle}>6. Obligations du Passager</Text>
        <Text style={styles.paragraph}>
          Le Passager s'engage à : {'\n'}
          - Être ponctuel (le Conducteur n'est pas tenu d'attendre au-delà de 15 minutes).{'\n'}
          - Payer le montant convenu pour le trajet (via l'application ou en espèces selon les paramètres).{'\n'}
          - Respecter le véhicule du Conducteur (propreté, calme).{'\n'}
          - Ne transporter aucune marchandise illicite ou dangereuse.
        </Text>

        <Text style={styles.sectionTitle}>7. Conditions Financières et Réservation</Text>
        <Text style={styles.paragraph}>
          <Text style={{fontWeight: 'bold'}}>Réservation : </Text> La réservation se fait exclusivement via l'application. Dès la confirmation par le Conducteur, un engagement ferme est établi.{'\n'}
          <Text style={{fontWeight: 'bold'}}>Participation financière : </Text> Elle est fixée par le Conducteur sous un plafond dicté par Zemy pour éviter toute concurrence déloyale ou profit.{'\n'}
          <Text style={{fontWeight: 'bold'}}>Frais de service (Commission) : </Text> Zemy prélève une commission sur chaque trajet payé en ligne pour couvrir les frais de fonctionnement de la plateforme. Le montant de cette commission est indiqué lors de la réservation.{'\n'}
          <Text style={{fontWeight: 'bold'}}>Paiement : </Text> Selon le trajet, le paiement peut être requis en ligne via Mobile Money/Carte ou en espèces au départ. Les fonds en ligne sont conservés de manière sécurisée et reversés au Conducteur une fois le trajet accompli.
        </Text>

        <Text style={styles.sectionTitle}>8. Annulations et Remboursements</Text>
        <Text style={styles.paragraph}>
          <Text style={{fontWeight: 'bold'}}>Par le Passager : </Text> En cas d'annulation moins de 24h avant le départ, des frais d'annulation pourront être retenus. Si l'annulation est due à une faute du Conducteur (retard, non-présentation), le remboursement est intégral.{'\n'}
          <Text style={{fontWeight: 'bold'}}>Par le Conducteur : </Text> L'annulation doit rester exceptionnelle. Une annulation répétée entraînera une suspension du compte. Le Passager sera alors intégralement remboursé.
        </Text>

        <Text style={styles.sectionTitle}>9. Responsabilité et Litiges</Text>
        <Text style={styles.paragraph}>
          Zemy agit exclusivement comme intermédiaire technologique de mise en relation. Nous déclinons toute responsabilité en cas de dommages (matériels, corporels, vols), de retards ou de désaccords entre les Utilisateurs. 
          En cas de litige, les Utilisateurs s'engagent à privilégier un règlement à l'amiable. L'équipe support Zemy peut agir en tant que médiateur si nécessaire, mais ne garantit pas la résolution du litige.
        </Text>

        <Text style={styles.sectionTitle}>10. Politique de Confidentialité</Text>
        <Text style={styles.paragraph}>
          La protection de vos données personnelles est essentielle pour nous. Vos données (localisation, identité, informations bancaires) sont cryptées et stockées conformément aux lois en vigueur. 
          Zemy ne vendra jamais vos informations à des tiers sans votre consentement explicite. Vos données sont utilisées uniquement pour le fonctionnement du service.
        </Text>

        <Text style={styles.sectionTitle}>11. Suspension de compte</Text>
        <Text style={styles.paragraph}>
          Zemy se réserve le droit de bloquer l'accès à ses services pour tout Utilisateur ne respectant pas les présentes CGU, recevant régulièrement des avis négatifs, ou ayant des comportements dangereux ou inappropriés signalés par la communauté.
        </Text>

        <Text style={styles.sectionTitle}>12. Loi applicable et juridiction compétente</Text>
        <Text style={styles.paragraph}>
          Les présentes Conditions sont soumises à la loi en vigueur dans le pays d'opération principal de Zemy. En cas de litige insoluble à l'amiable, les tribunaux compétents seront ceux du siège social de Zemy.
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
