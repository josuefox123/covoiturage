import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  ActivityIndicator, Platform, ScrollView, Modal, Pressable 
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CustomAlert } from '../src/utils/CustomAlert';
import { useAuth } from '../src/context/AuthContext';
import { fetchApi } from '../src/services/api';

const CATEGORIES = [
  { key: 'problem_ride', label: 'Problème de trajet', icon: 'car-outline' },
  { key: 'payment', label: 'Paiement', icon: 'card-outline' },
  { key: 'account', label: 'Compte', icon: 'person-outline' },
  { key: 'driver', label: 'Conducteur', icon: 'people-outline' },
  { key: 'suggestion', label: 'Suggestion', icon: 'bulb-outline' },
  { key: 'other', label: 'Autre', icon: 'help-circle-outline' }
];

export default function ContactScreen() {
  const router = useRouter();
  const { user, authFetch } = useAuth();

  // Form states
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // UI/API States
  const [isSending, setIsSending] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Errors states for inline validation
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateEmail = (text: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(text.trim());
  };

  const getSelectedCategoryLabel = () => {
    const found = CATEGORIES.find(cat => cat.key === category);
    return found ? found.label : 'Sélectionner une catégorie';
  };

  const handleSend = async () => {
    const formErrors: { [key: string]: string } = {};

    if (!name.trim()) formErrors.name = 'Le nom complet est obligatoire.';
    if (!email.trim()) {
      formErrors.email = "L'adresse email est obligatoire.";
    } else if (!validateEmail(email)) {
      formErrors.email = "L'adresse email n'est pas valide.";
    }
    if (!category) formErrors.category = 'Veuillez choisir une catégorie.';
    if (!subject.trim()) formErrors.subject = 'Le sujet est obligatoire.';
    if (!message.trim()) {
      formErrors.message = 'Le message est obligatoire.';
    } else if (message.trim().length < 10) {
      formErrors.message = 'Le message doit contenir au moins 10 caractères.';
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      CustomAlert.alert('Formulaire incomplet', 'Veuillez corriger les erreurs avant d\'envoyer.');
      return;
    }

    setErrors({});
    setIsSending(true);

    try {
      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        category,
        subject: subject.trim(),
        message: message.trim()
      };

      if (user) {
        await authFetch('/contact/', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } else {
        await fetchApi('/contact/', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      // Success
      setIsSending(false);
      // Empty form
      setName(user?.full_name || '');
      setEmail(user?.email || '');
      setCategory('');
      setSubject('');
      setMessage('');
      
      // Show success modal
      setShowSuccessModal(true);
    } catch (error: any) {
      setIsSending(false);
      const msg = error?.message || "Une erreur est survenue lors de l'envoi de votre message. Veuillez réessayer.";
      CustomAlert.alert('Erreur de connexion', msg);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support & Assistance</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 60}
      >
        {/* Support Header Section */}
        <View style={styles.introContainer}>
          <View style={styles.iconWrapper}>
            <Ionicons name="headset-outline" size={48} color={theme.colors.primary} />
          </View>
          <Text style={styles.introTitle}>Centre d'Aide</Text>
          <Text style={styles.introDescription}>
            Une question, un problème ou une suggestion ? Notre équipe est disponible pour vous répondre rapidement.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          {/* Nom */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nom complet</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
              placeholder="Ex: Jean Dupont"
              placeholderTextColor={theme.colors.textMuted}
              editable={!isSending}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Adresse email</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="Ex: jean.dupont@mail.com"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isSending}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Catégorie */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Catégorie</Text>
            <TouchableOpacity 
              style={[styles.pickerButton, errors.category && styles.inputError]}
              onPress={() => !isSending && setShowCategoryModal(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerButtonText, !category && styles.pickerButtonPlaceholder]}>
                {getSelectedCategoryLabel()}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.colors.textLight} />
            </TouchableOpacity>
            {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
          </View>

          {/* Sujet */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Sujet</Text>
            <TextInput
              style={[styles.input, errors.subject && styles.inputError]}
              value={subject}
              onChangeText={(text) => {
                setSubject(text);
                if (errors.subject) setErrors(prev => ({ ...prev, subject: '' }));
              }}
              placeholder="Ex: Problème de paiement"
              placeholderTextColor={theme.colors.textMuted}
              editable={!isSending}
            />
            {errors.subject && <Text style={styles.errorText}>{errors.subject}</Text>}
          </View>

          {/* Message */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.message && styles.inputError]}
              value={message}
              onChangeText={(text) => {
                setMessage(text);
                if (errors.message) setErrors(prev => ({ ...prev, message: '' }));
              }}
              placeholder="Décrivez votre problème ou votre suggestion avec précision..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!isSending}
            />
            {errors.message && <Text style={styles.errorText}>{errors.message}</Text>}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitBtn, isSending && styles.submitBtnDisabled]} 
            onPress={handleSend}
            disabled={isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator color={theme.colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Envoi de votre message...</Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Envoyer la demande</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick Contact Information */}
        <View style={styles.footerContacts}>
          <View style={styles.footerContactItem}>
            <Ionicons name="mail" size={18} color={theme.colors.primary} />
            <Text style={styles.footerContactText}>zemy@sinustic.com</Text>
          </View>
          <View style={styles.footerContactItem}>
            <Ionicons name="logo-whatsapp" size={18} color={theme.colors.success} />
            <Text style={styles.footerContactText}>+229 01 00 00 00</Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      {/* Category selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir une catégorie</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryItem,
                    category === cat.key && styles.categoryItemActive
                  ]}
                  onPress={() => {
                    setCategory(cat.key);
                    if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                    setShowCategoryModal(false);
                  }}
                >
                  <View style={styles.categoryLeft}>
                    <Ionicons 
                      name={cat.icon as any} 
                      size={22} 
                      color={category === cat.key ? theme.colors.primary : theme.colors.textLight} 
                    />
                    <Text style={[
                      styles.categoryLabel,
                      category === cat.key && styles.categoryLabelActive
                    ]}>
                      {cat.label}
                    </Text>
                  </View>
                  {category === cat.key && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.success} />
            </View>
            <Text style={styles.successTitle}>Message envoyé !</Text>
            <Text style={styles.successDescription}>
              Votre demande a bien été envoyée.{"\n\n"}Notre équipe vous répondra par email dans les meilleurs délais.
            </Text>
            <TouchableOpacity 
              style={styles.closeModalBtn} 
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
            >
              <Text style={styles.closeModalBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  
  introContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  introDescription: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  formCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 8, marginLeft: 2 },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, padding: 14,
    fontSize: 15, color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  textArea: { height: 120, textAlignVertical: 'top' },

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, padding: 14,
  },
  pickerButtonText: {
    fontSize: 15,
    color: theme.colors.text,
  },
  pickerButtonPlaceholder: {
    color: theme.colors.textMuted,
  },

  submitBtn: {
    backgroundColor: theme.colors.primary,
    padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.65 },
  submitBtnText: { color: theme.colors.white, fontSize: 16, fontWeight: '700' },
  loaderContainer: { flexDirection: 'row', alignItems: 'center' },

  footerContacts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 32,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerContactText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textLight,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  categoryList: {
    marginBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background,
  },
  categoryItemActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryLabel: {
    fontSize: 15,
    color: theme.colors.text,
  },
  categoryLabelActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },

  // Success Modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successContent: {
    width: '100%',
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  closeModalBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  }
});

