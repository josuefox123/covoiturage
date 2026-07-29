import { StyleSheet, Dimensions, Platform } from 'react-native';
import { theme } from '../../../../styles/theme';

const { width, height } = Dimensions.get('window');
const IS_SMALL_SCREEN = height < 700;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // ── En-tête ──────────────────────────────────────────────
  headerSection: {
    paddingTop: IS_SMALL_SCREEN ? 8 : 12,
    marginBottom: IS_SMALL_SCREEN ? 16 : 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: IS_SMALL_SCREEN ? 12 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // ── Brand ─────────────────────────────────────────────────
  brandContainer: {
    alignItems: 'center',
    marginBottom: IS_SMALL_SCREEN ? 14 : 22,
  },
  logoWrapper: {
    width: IS_SMALL_SCREEN ? 80 : 100,
    height: IS_SMALL_SCREEN ? 80 : 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    backgroundColor: '#fff',
    borderRadius: IS_SMALL_SCREEN ? 40 : 50,
  },
  logoImage: {
    width: '60%',
    height: '60%',
  },
  brandName: {
    fontSize: IS_SMALL_SCREEN ? 26 : 30,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 2,
  },

  // ── Titre bienvenue ────────────────────────────────────────
  welcomeContainer: {
    alignItems: 'center',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  welcomeTitle: {
    fontSize: IS_SMALL_SCREEN ? 20 : 24,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  waveEmoji: {
    fontSize: IS_SMALL_SCREEN ? 24 : 28,
    marginLeft: 6,
  },
  welcomeHighlight: {
    color: theme.colors.primary,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: theme.colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Carte premium ──────────────────────────────────────────
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 24,
    padding: IS_SMALL_SCREEN ? 18 : 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: theme.colors.border + '60',
  },

  // ── Groupe de champ ────────────────────────────────────────
  fieldGroup: {
    marginBottom: IS_SMALL_SCREEN ? 14 : 18,
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

  // ── Champ de saisie ────────────────────────────────────────
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 52,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  inputBoxFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
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
    paddingRight: 8,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  // ── Sélecteur de pays ──────────────────────────────────────
  countryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    height: '100%',
  },
  pickerButtonStyle: {},
  inputSeparator: {
    width: 1,
    height: 22,
    backgroundColor: theme.colors.border,
    marginHorizontal: 6,
  },
  callingCode: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginRight: 2,
    minWidth: 38,
  },

  // ── Champ téléphone PREMIUM ────────────────────────────────
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 18,
    height: 62,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  phoneInputContainerFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 7,
    backgroundColor: '#fff',
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: '100%',
    backgroundColor: theme.colors.card,
    gap: 5,
    borderRightWidth: 0,
  },
  phoneDivider: {
    width: 1.5,
    height: 32,
    backgroundColor: theme.colors.border,
  },
  phoneCallingCode: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    paddingHorizontal: 12,
    letterSpacing: 0.3,
  },
  phoneTextInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
    height: '100%',
    paddingVertical: 0,
    paddingRight: 8,
    letterSpacing: 1,
  },

  // ── Hint ──────────────────────────────────────────────────
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 2,
    gap: 4,
  },
  hintText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontStyle: 'italic',
  },

  // ── Bouton Connexion ───────────────────────────────────────
  loginBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
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
    color: '#fff',
    letterSpacing: 0.3,
  },

  // ── Footer ────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: theme.colors.textLight,
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
  },
  registerBtnText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '700',
  },

  // ── Spacer ────────────────────────────────────────────────
  bottomSpacer: {
    height: Platform.OS === 'ios' ? 32 : 160,
  },

  // ── Modal Styles ──────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 16, 29, 0.6)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoiding: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 30,
    minHeight: height * 0.45,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalCloseButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalStepContainer: {
    width: '100%',
  },
  stepWrapper: {
    width: '100%',
    paddingTop: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textLight,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalHighlightText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  modalFieldGroup: {
    marginBottom: 16,
  },
  modalInputBox: {
    backgroundColor: theme.colors.background,
  },
  modalButton: {
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  modalGradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // OTP Styles
  otpContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  otpBox: {
    width: 48,
    height: 52,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  otpBoxFocused: {
    borderColor: theme.colors.primary,
    backgroundColor: '#fff',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: theme.colors.primary,
  },
  otpText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  // Resend Timer
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    fontSize: 13,
    color: theme.colors.textLight,
  },
  timerText: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  resendLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },

  // Success Step Styles
  successWrapper: {
    alignItems: 'center',
    paddingTop: 20,
  },
  successIconWrapper: {
    marginBottom: 16,
    shadowColor: theme.colors.success || '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },

});
