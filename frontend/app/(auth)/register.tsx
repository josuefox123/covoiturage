import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '../../src/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import CustomAlert from '../../src/components/CustomAlert';

export default function RegisterScreen() {
  const router = useRouter();
  const { registerWithPassword } = useAuth();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', type: 'error' as any });

  const handleRegister = async () => {
    if (!lastName || !firstName || !email || !phone || !password) {
      setAlertConfig({ visible: true, title: "Attention", message: "Veuillez remplir tous les champs obligatoires.", type: 'warning' });
      return;
    }
    if (password !== confirmPassword) {
      setAlertConfig({ visible: true, title: "Erreur", message: "Les mots de passe ne correspondent pas.", type: 'error' });
      return;
    }

    setLoading(true);
    try {
      let formattedPhone = phone.trim();
      if (!formattedPhone.startsWith('+')) {
        const digits = formattedPhone.replace(/[\s\-]/g, '');
        formattedPhone = `+229${digits}`;
      }

      await registerWithPassword({
        full_name: `${firstName} ${lastName}`,
        email: email.trim(),
        phone: formattedPhone,
        password: password
      });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.log("Erreur d'inscription:", error?.message || error);
      setAlertConfig({ visible: true, title: "Erreur", message: "Impossible de créer le compte. Vérifiez si ce numéro ou cet email n'est pas déjà utilisé.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = !!(lastName && firstName && email && phone && password && confirmPassword);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Créer un compte 🚀</Text>
            <Text style={styles.subtitle}>
              Rejoignez notre réseau de covoiturage pour vous déplacer facilement.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nom</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ex: Koffi"
                  placeholderTextColor={theme.colors.textMuted}
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Prénom</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ex: Jean"
                  placeholderTextColor={theme.colors.textMuted}
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ex: jean@mail.com"
                  placeholderTextColor={theme.colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Numéro de téléphone</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="call-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ex: 0195959595 ou +229..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Mot de passe</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Créer un mot de passe"
                  placeholderTextColor={theme.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor={theme.colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.registerButton, (!isFormValid || loading) && styles.disabledButton]}
              onPress={handleRegister}
              disabled={loading || !isFormValid}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color={theme.colors.white} size="small" />
                  <Text style={styles.registerButtonText}>Veuillez patienter...</Text>
                </View>
              ) : (
                <Text style={styles.registerButtonText}>S'inscrire</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà membre ? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.loginLink}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.card, justifyContent: 'center', alignItems: 'center', marginTop: theme.spacing.md, marginBottom: theme.spacing.md, ...theme.shadows.sm },
  header: { marginBottom: theme.spacing.xl },
  title: { ...theme.typography.h2, color: theme.colors.text, marginBottom: theme.spacing.sm },
  subtitle: { ...theme.typography.bodyLarge, color: theme.colors.textLight },
  form: { backgroundColor: theme.colors.card, borderRadius: theme.borderRadius.xl, padding: theme.spacing.xl, ...theme.shadows.md, marginBottom: theme.spacing.xl },
  inputContainer: { marginBottom: theme.spacing.md },
  label: { ...theme.typography.bodyMedium, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.xs },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, height: 52, backgroundColor: theme.colors.background },
  inputIcon: { marginRight: theme.spacing.sm },
  input: { flex: 1, color: theme.colors.text, ...theme.typography.bodyMedium, height: '100%' },
  registerButton: { backgroundColor: theme.colors.primary, height: 52, borderRadius: theme.borderRadius.md, justifyContent: 'center', alignItems: 'center', marginTop: theme.spacing.sm, ...theme.shadows.sm },
  disabledButton: { opacity: 0.6 },
  registerButtonText: { ...theme.typography.button, color: theme.colors.white },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 'auto' },
  footerText: { ...theme.typography.bodyMedium, color: theme.colors.textLight },
  loginLink: { ...theme.typography.bodyMedium, color: theme.colors.primary, fontWeight: '700' },
});
