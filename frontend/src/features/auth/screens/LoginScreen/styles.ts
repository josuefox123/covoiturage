/**
 * ==============================================================
 * Fichier :
 * LoginScreen/styles.ts
 *
 * Description :
 * Styles modernes, épurés et haut de gamme pour l'écran de connexion Zemy.
 *
 * Projet :
 * Zemy
 * ==============================================================
 */

import { StyleSheet, Dimensions, Platform } from 'react-native';
import { theme } from '../../../../styles/theme';

const { height } = Dimensions.get('window');
const IS_SMALL = height < 700;

export const styles = StyleSheet.create({
  // ── Conteneurs principaux ─────────────────────────────────────
  keyboardWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 40,
    justifyContent: 'space-between',
  },

  // ── Top Navigation / Bouton Retour ────────────────────────────
  topBar: {
    paddingTop: IS_SMALL ? 4 : 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: IS_SMALL ? 8 : 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },

  // ── En-tête / Identité visuelle ───────────────────────────────
  headerSection: {
    alignItems: 'center',
    marginBottom: IS_SMALL ? 16 : 24,
    paddingHorizontal: 8,
  },
  logoWrapper: {
    width: IS_SMALL ? 56 : 64,
    height: IS_SMALL ? 56 : 64,
    borderRadius: IS_SMALL ? 16 : 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  logoImage: {
    width: '72%',
    height: '72%',
  },
  welcomeTitle: {
    fontSize: IS_SMALL ? 22 : 25,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
  },

  // ── Carte Formulaire ──────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: IS_SMALL ? 18 : 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 20,
  },

  // ── Groupes de champs ─────────────────────────────────────────
  fieldGroup: {
    marginBottom: IS_SMALL ? 14 : 18,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  forgotLink: {
    fontSize: 12.5,
    color: '#2563EB',
    fontWeight: '600',
  },

  // ── État focus partagé ────────────────────────────────────────
  inputFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },

  // ── Champ téléphone ───────────────────────────────────────────
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 52,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: '100%',
    backgroundColor: 'transparent',
    gap: 4,
  },
  pickerButtonStyle: {},
  phoneDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  phoneCallingCode: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#2563EB',
    paddingHorizontal: 8,
    letterSpacing: 0.2,
  },
  phoneTextInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
    height: '100%',
    paddingVertical: 0,
    paddingRight: 4,
    letterSpacing: 0.4,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Hint format ───────────────────────────────────────────────
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
    paddingHorizontal: 2,
  },
  hintText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '500',
  },

  // ── Champ mot de passe ────────────────────────────────────────
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 52,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  inputLeadingIcon: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '500',
    height: '100%',
    paddingVertical: 0,
    paddingRight: 4,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Bouton Connexion ──────────────────────────────────────────
  loginBtnWrap: {
    marginTop: 6,
    marginBottom: 12,
    borderRadius: 13,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  loginBtn: {
    height: 52,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── Badge de sécurité discret ─────────────────────────────────
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 4,
  },
  securityText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
  },

  // ── Footer (Inscription) ──────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 13.5,
    color: '#64748B',
    fontWeight: '500',
  },
  registerLinkText: {
    fontSize: 13.5,
    color: '#2563EB',
    fontWeight: '700',
  },
});
