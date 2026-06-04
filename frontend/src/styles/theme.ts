export const theme = {
  colors: {
    // Primary - Blue (from index.tsx: #3B82F6)
    primary: '#3B82F6',
    primaryLight: '#EFF6FF',
    primaryDark: '#1D4ED8',

    // Secondary - Sky Blue accent (from index.tsx: #0284C7)
    secondary: '#0284C7',
    secondaryLight: '#E0F2FE',
    secondaryDark: '#0369A1',

    // Grayscale
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#0F172A',
    textLight: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',

    // Generic
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
    gray: '#9CA3AF',
    grayLight: '#E5E7EB',
    grayDark: '#4B5563',

    // Feedback
    success: '#10B981',
    successLight: '#D1FAE5',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    warningDark: '#B45309',

    // Custom overlays / opacity colors
    overlay: 'rgba(0, 0, 0, 0.4)',
    glass: 'rgba(255, 255, 255, 0.8)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  typography: {
    h1: {
      fontSize: 32,
      fontWeight: '700' as const,
      lineHeight: 40,
    },
    h2: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 32,
    },
    h3: {
      fontSize: 20,
      fontWeight: '600' as const,
      lineHeight: 28,
    },
    bodyLarge: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
    },
    bodyMedium: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
    },
    bodySmall: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 16,
    },
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    caption: {
      fontSize: 11,
      fontWeight: '500' as const,
      lineHeight: 14,
    },
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
  }
};

export type Theme = typeof theme;
