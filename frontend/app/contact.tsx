/**
 * ==============================================================
 * Fichier :
 * contact.tsx
 *
 * Description :
 * Composant ou logique de l'application Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CustomAlert } from '../src/utils/CustomAlert';

/**
 * Composant ContactScreen.
 *
 * Responsabilités :
 * - Affichage et gestion de l'état lié à ContactScreen.
 */
export default function ContactScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = () => {
    if (!subject.trim() || !message.trim()) {
      CustomAlert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    
    setIsSending(true);
    // Simulation of sending an email or API call
    setTimeout(() => {
      setIsSending(false);
      CustomAlert.alert('Succès', 'Votre message a été envoyé à notre équipe de support. Nous vous répondrons dans les plus brefs délais.');
      router.back();
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nous contacter</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 60}
      >
        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <Ionicons name="mail-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.infoText}>support@zemy.bj</Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="call-outline" size={24} color={theme.colors.primary} />
            <Text style={styles.infoText}>+229 00 00 00 00</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Envoyez-nous un message</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Sujet</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Ex: Problème avec un trajet"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Décrivez votre problème en détail..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, (!subject.trim() || !message.trim()) && styles.submitBtnDisabled]} 
          onPress={handleSend}
          disabled={isSending || (!subject.trim() || !message.trim())}
        >
          {isSending ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={styles.submitBtnText}>Envoyer le message</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
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
  infoCards: { flexDirection: 'row', gap: 12, marginBottom: 32, marginTop: 8 },
  infoCard: {
    flex: 1, backgroundColor: theme.colors.white,
    padding: 16, borderRadius: 12, alignItems: 'center',
    shadowColor: theme.colors.black, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2
  },
  infoText: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginBottom: 16 },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8, marginLeft: 4 },
  input: {
    backgroundColor: theme.colors.white,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, padding: 16,
    fontSize: 15, color: theme.colors.text,
  },
  textArea: { height: 150 },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 16,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: theme.colors.white, fontSize: 16, fontWeight: '700' }
});
