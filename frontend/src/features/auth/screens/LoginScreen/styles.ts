/**
 * ==============================================================
 * Fichier :
 * LoginScreen/styles.ts
 *
 * Description :
 * Styles premium pour l'écran de connexion Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */

import { StyleSheet, Dimensions, Platform } from 'react-native';
import { theme } from '../../../../styles/theme';

const { height } = Dimensions.get('window');

// Détection des écrans petits (< 700px de haut)
const IS_SMALL = height < 700;

export const styles = StyleSheet.create({
  // ── Conteneurs principaux ─────────────────────────────────────
  keyboardWrapper: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 32,
  },

  // ── En-tête ───────────────────────────────────────────────────
  headerSection: {
    paddingTop: IS_SMALL ? 4 : 8,
    marginBottom: IS_SMALL ? 18 : 26,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IS_SMALL ? 14 : 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    // Shadow très légère
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Logo / Marque ─────────────────────────────────────────────
  brandContainer: {
    alignItems: 'center',
    marginBottom: IS_SMALL ? 16 : 24,
  },
  logoWrapper: {
    width: IS_SMALL ? 76 : 92,
    height: IS_SMALL ? 76 : 92,
    borderRadius: IS_SMALL ? 38 : 46,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    // Shadow subtile bleutée
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logoImage: {
    width: '62%',
    height: '62%',
  },
  brandTagline: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.4,
  },

  // ── Titre bienvenue ───────────────────────────────────────────
  welcomeContainer: {
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: IS_SMALL ? 22 : 26,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },

  // ── Carte de connexion ────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 22,
    padding: IS_SMALL ? 18 : 24,
    marginBottom: 20,
    // Shadow premium
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 5,
    // Bordure subtile
    borderWidth: 1,
    borderColor: theme.colors.border + '80',
  },

  // ── Groupes de champs ─────────────────────────────────────────
  fieldGroup: {
    marginBottom: IS_SMALL ? 14 : 18,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  forgotLink: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },

  // ── État focus partagé ────────────────────────────────────────
  // Utilisé pour les deux champs (téléphone & mot de passe)
  inputFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: '#FFFFFF',
  },

  // ── Champ téléphone ───────────────────────────────────────────
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 54,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
    // Shadow subtile
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: '100%',
    backgroundColor: theme.colors.background,
    gap: 4,
  },
  pickerButtonStyle: {},
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.colors.border,
    marginHorizontal: 2,
  },
  phoneCallingCode: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.primary,
    paddingHorizontal: 10,
    letterSpacing: 0.2,
  },
  phoneTextInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
    height: '100%',
    paddingVertical: 0,
    paddingRight: 4,
    letterSpacing: 0.5,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Hint de format ────────────────────────────────────────────
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
    paddingHorizontal: 2,
  },
  hintText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontStyle: 'italic',
    fontWeight: '500',
  },

  // ── Champ mot de passe ────────────────────────────────────────
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 54,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputLeadingIcon: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
    paddingRight: 4,
    fontWeight: '400',
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Bouton Connexion ──────────────────────────────────────────
  loginBtnWrap: {
    marginTop: 4,
    marginBottom: 14,
    // Shadow du bouton actif
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: 14,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  loginBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── Badge de sécurité ─────────────────────────────────────────
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  securityText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },

  // ── Footer (inscription) ──────────────────────────────────────
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textLight,
    fontWeight: '400',
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    // Mini shadow
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  registerBtnText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '700',
  },

  // ── Spacer bas ────────────────────────────────────────────────
  bottomSpacer: {
    height: Platform.OS === 'ios' ? 24 : 100,
  },
});
