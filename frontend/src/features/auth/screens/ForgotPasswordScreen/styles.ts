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
    paddingBottom: 24,
  },
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
  stepContainer: {
    flex: 1,
    width: '100%',
  },
  stepWrapper: {
    width: '100%',
    paddingTop: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textLight,
    lineHeight: 22,
    marginBottom: 24,
  },
  highlightText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 14,
    height: 56,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  inputLeadingIcon: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
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
  button: {
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
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
    height: 56,
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
    fontSize: 22,
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
    marginTop: 10,
  },
  resendText: {
    fontSize: 14,
    color: theme.colors.textLight,
  },
  timerText: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  resendLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },

  // Success Step Styles
  successWrapper: {
    alignItems: 'center',
    paddingTop: 40,
    flex: 1,
    justifyContent: 'center',
  },
  successIconWrapper: {
    marginBottom: 24,
    shadowColor: theme.colors.success || '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: theme.colors.textLight,
    lineHeight: 22,
    marginBottom: 40,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
