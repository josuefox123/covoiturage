import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#DBEAFE', // Blue 100
          DEFAULT: '#2563EB', // Blue 600
          dark: '#1D4ED8', // Blue 700
        },
        secondary: {
          light: '#D1FAE5', // Emerald 100
          DEFAULT: '#10B981', // Emerald 500
          dark: '#059669', // Emerald 600
        },
        accent: {
          light: '#FFF3D6',
          DEFAULT: '#FFAA00',
          dark: '#CC8800',
        },
        background: '#F8FAFC',
        card: '#FFFFFF',
        text: '#0F172A',
        textLight: '#475569',
        textMuted: '#94A3B8',
        border: '#E2E8F0',
        success: {
          light: '#D1FAE5',
          DEFAULT: '#10B981',
        },
        error: {
          light: '#FEE2E2',
          DEFAULT: '#EF4444',
        },
        warning: {
          light: '#FEF3C7',
          DEFAULT: '#F59E0B',
          dark: '#B45309',
        },
      }
    }
  }
}
